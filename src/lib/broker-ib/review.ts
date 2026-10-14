import type { BrokerAccountStatus, Prisma, PrismaClient } from "@prisma/client";
import type { ActorContext } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { carryOverProvisioning, nextPeriodFor, repackFutureSegments } from "@/lib/admin/membership";
import { lockOrder, normalizeReason } from "@/lib/admin/order-review";
import { isWithinClaimWindow } from "./rules";
import { accountLockKey } from "./claims";
import { verifierFor } from "./verifier";

type Tx = Prisma.TransactionClient;

const TRANSACTION_TIMEOUT_MS = 15_000;

/** สิ่งที่แอดมินยืนยันจาก Partner Portal ก่อนอนุมัติ (ต้องครบทุกข้อ) */
export interface BrokerClaimChecks {
  /** พบบัญชีนี้ภายใต้ IB ของเรา */
  underIb: boolean;
  /** อีเมลตรงกับบัญชีในระบบโบรกเกอร์ */
  emailMatches: boolean;
  /** ครั้งแรก: ฝากครั้งแรกถึงขั้นต่ำ / ต่ออายุ: บัญชียังใช้งานตามเงื่อนไข */
  qualifies: boolean;
}

export type ApproveBrokerClaimResult =
  | { ok: true; orderNumber: string; email: string; periodStart: Date; periodEnd: Date; isRenewal: boolean }
  | { ok: false; code: "ORDER_NOT_FOUND" | "NOT_PENDING_REVIEW" | "CHECKS_REQUIRED" | "SELF_APPROVAL" | "ACCOUNT_RELEASED" | "NOT_IN_RENEWAL_WINDOW" };

export type RevokeBrokerAccessResult =
  | { ok: true; revoked: number; continuing: boolean; rejectedClaims: number }
  | { ok: false; code: "MEMBER_NOT_FOUND" | "REASON_REQUIRED" | "NOTHING_TO_REVOKE" };

export type ReleaseBrokerAccountResult =
  | { ok: true; rejectedClaims: number; userId: string }
  | { ok: false; code: "BROKER_ACCOUNT_NOT_FOUND" | "REASON_REQUIRED" | "ALREADY_RELEASED" };

export type RejectBrokerClaimResult =
  | { ok: true; orderNumber: string; email: string; reason: string; released: boolean }
  | { ok: false; code: "ORDER_NOT_FOUND" | "NOT_PENDING_REVIEW" | "REASON_REQUIRED" };

interface LockedBinding {
  id: string;
  userId: string;
  status: BrokerAccountStatus;
  firstVerifiedAt: Date | null;
}

async function lockBindingById(tx: Tx, id: string): Promise<LockedBinding | null> {
  const [row] = await tx.$queryRaw<LockedBinding[]>`
    SELECT id, "userId", status, "firstVerifiedAt" FROM "BrokerAccount" WHERE id = ${id} FOR UPDATE
  `;
  return row ?? null;
}

const lockMembership = (tx: Tx, userId: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`membership:${userId}`}))`;

/**
 * อนุมัติคำขอสิทธิ์ผ่าน IB หลังแอดมินตรวจใน Partner Portal
 * ล็อกตามลำดับ: แถวออเดอร์ → สมาชิก (advisory) → แถวบัญชีเทรด — อนุมัติซ้ำ/พร้อมกันไม่ได้ และช่วงสิทธิ์ไม่ซ้อนกับแพ็กเกจที่จ่ายเงิน
 * สร้าง Subscription ปกติ (ทบวัน, หมดอายุ, เตือน, เปิดสิทธิ์ช่องทาง ใช้ระบบเดิมทั้งหมด) — ไม่ล็อกราคา ไม่นับที่นั่งโปรโมชัน
 */
export async function approveBrokerClaim(
  db: PrismaClient,
  input: { orderId: string; actor: ActorContext; checks: BrokerClaimChecks; note?: string; now?: Date },
): Promise<ApproveBrokerClaimResult> {
  const now = input.now ?? new Date();
  const { underIb, emailMatches, qualifies } = input.checks;
  if (!underIb || !emailMatches || !qualifies) return { ok: false, code: "CHECKS_REQUIRED" };
  const note = input.note?.trim().slice(0, 300) || null;

  return db.$transaction(
    async (tx): Promise<ApproveBrokerClaimResult> => {
      const locked = await lockOrder(tx, input.orderId);
      if (!locked) return { ok: false, code: "ORDER_NOT_FOUND" };
      if (locked.status !== "CLAIM_SUBMITTED" || locked.kind !== "BROKER_IB") return { ok: false, code: "NOT_PENDING_REVIEW" };
      if (locked.userId === input.actor.id) return { ok: false, code: "SELF_APPROVAL" };

      const order = await tx.order.findUniqueOrThrow({
        where: { id: input.orderId },
        include: { plan: true, user: { select: { email: true } }, brokerAccount: true },
      });
      if (!order.brokerAccount) return { ok: false, code: "ACCOUNT_RELEASED" };

      await lockMembership(tx, order.userId);
      const binding = await lockBindingById(tx, order.brokerAccount.id);
      if (!binding || binding.userId !== order.userId || binding.status === "RELEASED") return { ok: false, code: "ACCOUNT_RELEASED" };

      const period = await nextPeriodFor(tx, { userId: order.userId, now, durationDays: order.plan.durationDays });
      // ตรวจช่วงยื่นซ้ำ: ระหว่างรอตรวจ สมาชิกอาจซื้อแพ็กเกจจ่ายเงินไปแล้ว — ห้ามสะสมเดือนฟรีล่วงหน้า
      if (!isWithinClaimWindow(period.start, now)) return { ok: false, code: "NOT_IN_RENEWAL_WINDOW" };
      const isRenewal = binding.firstVerifiedAt !== null;

      await tx.subscription.create({
        data: {
          userId: order.userId,
          planId: order.planId,
          orderId: order.id,
          status: "ACTIVE",
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
          isPriceLocked: false,
          lockedPrice: null,
        },
      });
      await tx.brokerAccount.update({
        where: { id: binding.id },
        data: { status: "VERIFIED", firstVerifiedAt: binding.firstVerifiedAt ?? now, lastVerifiedAt: now, lastVerifiedByUserId: input.actor.id },
      });
      await tx.order.update({ where: { id: order.id }, data: { status: "APPROVED", approvedAt: now, approvedByUserId: input.actor.id } });
      await writeAudit(tx, {
        actor: input.actor,
        action: "BROKER_CLAIM_APPROVE",
        targetType: "Order",
        targetId: order.id,
        details: {
          before: { status: locked.status, bindingStatus: binding.status },
          after: { status: "APPROVED", bindingStatus: "VERIFIED" },
          orderNumber: order.orderNumber,
          broker: order.brokerAccount.broker,
          platform: order.brokerAccount.platform,
          accountNumber: order.brokerAccount.accountNumber,
          registeredEmail: order.brokerAccount.registeredEmail,
          minDepositUsd: order.ibMinDepositUsd?.toNumber() ?? null,
          checks: { underIb, emailMatches, qualifies },
          note,
          method: verifierFor(order.brokerAccount.broker)?.method ?? "MANUAL",
          isRenewal,
          periodStart: period.start.toISOString(),
          periodEnd: period.end.toISOString(),
        },
      });
      return { ok: true, orderNumber: order.orderNumber, email: order.user.email, periodStart: period.start, periodEnd: period.end, isRenewal };
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

/**
 * ปฏิเสธคำขอสิทธิ์ผ่าน IB — เลือกปลดการผูกบัญชีได้ (ปลดแล้วสมาชิกคนใดก็ยื่นบัญชีนี้ได้ เช่นกรณีมีคนยื่นบัญชีของคนอื่นดักไว้)
 * ล็อกตามลำดับ: แถวออเดอร์ → แถวบัญชีเทรด
 */
export async function rejectBrokerClaim(
  db: PrismaClient,
  input: { orderId: string; actor: ActorContext; reason: string; releaseAccount: boolean; now?: Date },
): Promise<RejectBrokerClaimResult> {
  const now = input.now ?? new Date();
  const reason = normalizeReason(input.reason);
  if (!reason) return { ok: false, code: "REASON_REQUIRED" };

  return db.$transaction(
    async (tx): Promise<RejectBrokerClaimResult> => {
      const locked = await lockOrder(tx, input.orderId);
      if (!locked) return { ok: false, code: "ORDER_NOT_FOUND" };
      if (locked.status !== "CLAIM_SUBMITTED" || locked.kind !== "BROKER_IB") return { ok: false, code: "NOT_PENDING_REVIEW" };

      const order = await tx.order.findUniqueOrThrow({
        where: { id: input.orderId },
        select: { orderNumber: true, userId: true, brokerAccountId: true, user: { select: { email: true } } },
      });
      const binding = order.brokerAccountId ? await lockBindingById(tx, order.brokerAccountId) : null;
      const release = input.releaseAccount && binding !== null && binding.userId === order.userId && binding.status !== "RELEASED";
      if (release && binding) {
        await tx.brokerAccount.update({ where: { id: binding.id }, data: { status: "RELEASED", releasedAt: now, releaseReason: reason } });
      }
      await tx.order.update({ where: { id: input.orderId }, data: { status: "REJECTED", rejectedAt: now, rejectionReason: reason } });
      await writeAudit(tx, {
        actor: input.actor,
        action: "BROKER_CLAIM_REJECT",
        targetType: "Order",
        targetId: input.orderId,
        details: {
          before: { status: locked.status, bindingStatus: binding?.status ?? null },
          after: { status: "REJECTED", bindingStatus: release ? "RELEASED" : (binding?.status ?? null) },
          orderNumber: order.orderNumber,
          brokerAccountId: binding?.id ?? null,
          reason,
          released: release,
        },
      });
      return { ok: true, orderNumber: order.orderNumber, email: order.user.email, reason, released: release };
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

const LIVE = ["ACTIVE", "EXPIRING_SOON"] as const;

/** ข้อความที่สมาชิกเห็นเมื่อคำขอถูกปฏิเสธอัตโนมัติ — เหตุผลจริงของแอดมินอยู่ใน Audit Log เท่านั้น (อาจมีข้อมูลผู้อื่น/หลักฐาน) */
export const AUTO_REJECT_REASON = {
  REVOKE: "ทีมงานปิดสิทธิ์ผ่าน IB ของบัญชีนี้ — ติดต่อทีมงานหากมีข้อสงสัย",
  RELEASE: "บัญชีเทรดนี้ถูกปลดการผูกโดยทีมงาน — ติดต่อทีมงานหากมีข้อสงสัย",
} as const;

/**
 * ปฏิเสธคำขอที่รอตรวจทั้งหมดตามเงื่อนไข (ล็อกแถวออเดอร์ก่อน เรียงตาม id — ลำดับเดียวกับการอนุมัติ จึงไม่ deadlock)
 * แถวที่ถูกอนุมัติ/ปฏิเสธไปก่อนหน้าจะไม่ผ่านเงื่อนไขสถานะหลังรอ lock (PostgreSQL ตรวจ WHERE ซ้ำ) จึงไม่ถูกแตะ
 */
async function rejectPendingClaims(tx: Tx, where: { userId: string } | { brokerAccountId: string }, reason: string, now: Date): Promise<string[]> {
  const rows =
    "userId" in where
      ? await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Order" WHERE "userId" = ${where.userId} AND kind = 'BROKER_IB' AND status = 'CLAIM_SUBMITTED' ORDER BY id FOR UPDATE
        `
      : await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Order" WHERE "brokerAccountId" = ${where.brokerAccountId} AND kind = 'BROKER_IB' AND status = 'CLAIM_SUBMITTED' ORDER BY id FOR UPDATE
        `;
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  await tx.order.updateMany({ where: { id: { in: ids }, status: "CLAIM_SUBMITTED" }, data: { status: "REJECTED", rejectedAt: now, rejectionReason: reason } });
  return ids;
}

/**
 * ปิดสิทธิ์ผ่าน IB ของสมาชิก (เช่น บัญชีออกจาก IB แล้ว / ข้อมูลเท็จ) — ปิดเฉพาะช่วงสิทธิ์ที่ได้จาก IB
 * ช่วงที่จ่ายเงินซึ่งต่อคิวอยู่เลื่อนมาเริ่มทันที (ลูกค้าที่จ่ายเงินไม่เสียวัน) และสถานะเปิดสิทธิ์ช่องทางย้ายตามไป
 * ล็อกตามลำดับ: แถวคำขอที่รอตรวจ → สมาชิก (advisory) → แถวบัญชีเทรด
 */
export async function revokeBrokerAccess(
  db: PrismaClient,
  input: { userId: string; actor: ActorContext; reason: string; releaseAccount: boolean; now?: Date },
): Promise<RevokeBrokerAccessResult> {
  const now = input.now ?? new Date();
  const reason = normalizeReason(input.reason);
  if (!reason) return { ok: false, code: "REASON_REQUIRED" };

  return db.$transaction(
    async (tx): Promise<RevokeBrokerAccessResult> => {
      const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true, email: true } });
      if (!user) return { ok: false, code: "MEMBER_NOT_FOUND" };

      // ล็อกเดียวกับการยื่นคำขอของสมาชิกคนนี้ — คำขอที่ยื่นเข้ามาระหว่างปิดสิทธิ์ต้องรอ ไม่หลุดไปค้างในคิว
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`broker-claim:${user.id}`}))`;
      const rejectedClaimIds = await rejectPendingClaims(tx, { userId: user.id }, AUTO_REJECT_REASON.REVOKE, now);
      const rejectedClaims = rejectedClaimIds.length;
      await lockMembership(tx, user.id);
      const live = await tx.subscription.findMany({
        where: { userId: user.id, plan: { kind: "BROKER_IB" }, status: { in: [...LIVE] }, currentPeriodEnd: { gt: now } },
        select: { id: true, currentPeriodStart: true, currentPeriodEnd: true, tradingViewGranted: true, discordRoleGranted: true, telegramGranted: true },
      });
      const binding = input.releaseAccount
        ? await tx.brokerAccount.findFirst({ where: { userId: user.id, status: { in: ["PENDING", "VERIFIED"] } }, select: { id: true } })
        : null;
      if (live.length === 0 && rejectedClaims === 0 && !binding) return { ok: false, code: "NOTHING_TO_REVOKE" };

      const { count: revoked } = await tx.subscription.updateMany({
        where: { id: { in: live.map((segment) => segment.id) } },
        data: { status: "REVOKED", revokedAt: now, revocationReason: reason },
      });
      const periodsMoved = await repackFutureSegments(tx, { userId: user.id, now });
      const carried = await carryOverProvisioning(tx, { userId: user.id, fromIds: live.map((segment) => segment.id), now });
      let released = false;
      if (binding) {
        const locked = await lockBindingById(tx, binding.id);
        if (locked && locked.userId === user.id && locked.status !== "RELEASED") {
          await tx.brokerAccount.update({ where: { id: locked.id }, data: { status: "RELEASED", releasedAt: now, releaseReason: reason } });
          released = true;
        }
      }
      const continuing =
        (await tx.subscription.count({
          where: { userId: user.id, status: { in: [...LIVE] }, currentPeriodStart: { lte: now }, currentPeriodEnd: { gt: now } },
        })) > 0;
      await writeAudit(tx, {
        actor: input.actor,
        action: "BROKER_IB_REVOKE",
        targetType: "User",
        targetId: user.id,
        details: {
          email: user.email,
          reason,
          subscriptionsRevoked: revoked,
          revokedSubscriptions: live.map((segment) => ({
            ...segment,
            currentPeriodStart: segment.currentPeriodStart.toISOString(),
            currentPeriodEnd: segment.currentPeriodEnd.toISOString(),
          })),
          rejectedClaims,
          rejectedClaimIds,
          periodsMoved,
          continuing,
          released,
          carriedOver: carried ? { toSubscriptionId: carried.toSubscriptionId, channels: carried.channels } : null,
        },
      });
      return { ok: true, revoked, continuing, rejectedClaims };
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

/**
 * ปลดการผูกบัญชีเทรด (เช่น เจ้าของบัญชีจริงแสดงหลักฐานว่ามีคนยื่นดักไว้) — ไม่กระทบสิทธิ์ที่อนุมัติไปแล้ว (ใช้ revokeBrokerAccess)
 * ล็อกตามลำดับ: แถวคำขอที่รอตรวจของบัญชีนี้ → แถวบัญชีเทรด
 */
export async function releaseBrokerAccount(
  db: PrismaClient,
  input: { brokerAccountId: string; actor: ActorContext; reason: string; now?: Date },
): Promise<ReleaseBrokerAccountResult> {
  const now = input.now ?? new Date();
  const reason = normalizeReason(input.reason);
  if (!reason) return { ok: false, code: "REASON_REQUIRED" };

  return db.$transaction(
    async (tx): Promise<ReleaseBrokerAccountResult> => {
      const account = await tx.brokerAccount.findUnique({ where: { id: input.brokerAccountId }, select: { broker: true, accountNumber: true } });
      if (!account) return { ok: false, code: "BROKER_ACCOUNT_NOT_FOUND" };
      // ล็อกเดียวกับการยื่นคำขอบัญชีนี้ — คำขอที่ยื่นเข้ามาระหว่างปลดต้องรอ ไม่หลุดไปค้างในคิว
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${accountLockKey(account.broker, account.accountNumber)}))`;
      const rejectedClaimIds = await rejectPendingClaims(tx, { brokerAccountId: input.brokerAccountId }, AUTO_REJECT_REASON.RELEASE, now);
      const rejectedClaims = rejectedClaimIds.length;
      const binding = await lockBindingById(tx, input.brokerAccountId);
      if (!binding) return { ok: false, code: "BROKER_ACCOUNT_NOT_FOUND" };
      if (binding.status === "RELEASED") return { ok: false, code: "ALREADY_RELEASED" };

      await tx.brokerAccount.update({ where: { id: binding.id }, data: { status: "RELEASED", releasedAt: now, releaseReason: reason } });
      await writeAudit(tx, {
        actor: input.actor,
        action: "BROKER_ACCOUNT_RELEASE",
        targetType: "BrokerAccount",
        targetId: binding.id,
        details: { before: { status: binding.status, userId: binding.userId }, after: { status: "RELEASED" }, reason, rejectedClaims, rejectedClaimIds },
      });
      return { ok: true, rejectedClaims, userId: binding.userId };
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}
