import { Prisma, type OrderStatus, type PrismaClient } from "@prisma/client";
import type { ActorContext } from "./guard";
import { writeAudit } from "./audit";
import { carryOverProvisioning, nextPeriodFor, repackFutureSegments } from "./membership";

type Tx = Prisma.TransactionClient;

const TRANSACTION_TIMEOUT_MS = 15_000;
const REASON_MIN = 2;
const REASON_MAX = 300;
const REFERENCE_PATTERN = /^[A-Z0-9]{4,64}$/;

export type ApproveResult =
  | { ok: true; orderNumber: string; email: string; planName: string; amount: number; periodStart: Date; periodEnd: Date; promoOversold: boolean }
  | { ok: false; code: "ORDER_NOT_FOUND" | "NOT_PENDING_REVIEW" | "REFERENCE_REQUIRED" | "INVALID_REFERENCE" | "DUPLICATE_REFERENCE" | "SELF_APPROVAL" };

export type RejectResult =
  | { ok: true; orderNumber: string; email: string; reason: string }
  | { ok: false; code: "ORDER_NOT_FOUND" | "NOT_PENDING_REVIEW" | "REASON_REQUIRED" };

export type RefundResult =
  | { ok: true; orderNumber: string; email: string; amount: number; continuing: boolean }
  | { ok: false; code: "ORDER_NOT_FOUND" | "NOT_REFUNDABLE" | "INVALID_AMOUNT" | "REASON_REQUIRED" };

/** ทำให้เลขอ้างอิงธนาคารเป็นรูปแบบเดียวกัน (ตัดช่องว่าง/ขีด, ตัวพิมพ์ใหญ่) เพื่อให้เทียบซ้ำได้จริง */
export function normalizeBankReference(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

function normalizeReason(raw: string): string | null {
  const reason = raw.trim().replace(/\s+/g, " ");
  return reason.length >= REASON_MIN && reason.length <= REASON_MAX ? reason : null;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** ล็อกแถวออเดอร์ (SELECT ... FOR UPDATE) — คำขอซ้ำ/พร้อมกันจะรอแล้วเห็นสถานะล่าสุด */
async function lockOrder(tx: Tx, orderId: string): Promise<{ id: string; status: OrderStatus } | null> {
  const [row] = await tx.$queryRaw<{ id: string; status: OrderStatus }[]>`SELECT id, status FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
  return row ?? null;
}

/**
 * อนุมัติออเดอร์ (Flow 4 + 5 ใน docs/PLAN.md)
 * - ต้องมีเลขอ้างอิงธนาคาร (unique) กันสลิปที่ถูกแก้ไฟล์แล้วนำมาใช้ซ้ำ
 * - ล็อกแถวออเดอร์ + advisory lock ของสมาชิก → อนุมัติซ้ำไม่ได้ และช่วงสิทธิ์ไม่ซ้อนกัน
 * - ต่ออายุแบบทบวัน, นับโควตาโปรโมชัน, ล็อกราคา, บันทึก AuditLog ใน transaction เดียวกัน
 */
export async function approveOrder(
  db: PrismaClient,
  input: { orderId: string; actor: ActorContext; referenceNo: string; now?: Date },
): Promise<ApproveResult> {
  const now = input.now ?? new Date();
  const referenceNo = normalizeBankReference(input.referenceNo);
  if (!referenceNo) return { ok: false, code: "REFERENCE_REQUIRED" };
  if (!REFERENCE_PATTERN.test(referenceNo)) return { ok: false, code: "INVALID_REFERENCE" };

  try {
    return await db.$transaction(
      async (tx): Promise<ApproveResult> => {
        const locked = await lockOrder(tx, input.orderId);
        if (!locked) return { ok: false, code: "ORDER_NOT_FOUND" };
        if (locked.status !== "SLIP_SUBMITTED") return { ok: false, code: "NOT_PENDING_REVIEW" };

        const order = await tx.order.findUniqueOrThrow({
          where: { id: input.orderId },
          include: { plan: true, user: { select: { id: true, email: true } } },
        });
        // แยกหน้าที่: แอดมินห้ามอนุมัติออเดอร์ที่ตัวเองเป็นผู้ซื้อ
        if (order.userId === input.actor.id) return { ok: false, code: "SELF_APPROVAL" };
        const reused = await tx.payment.findUnique({ where: { referenceNo }, select: { orderId: true } });
        if (reused && reused.orderId !== order.id) return { ok: false, code: "DUPLICATE_REFERENCE" };

        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`membership:${order.userId}`}))`;
        const period = await nextPeriodFor(tx, { userId: order.userId, now, durationDays: order.plan.durationDays });

        // ผู้ที่ถือราคาล็อกของแพ็กเกจนี้อยู่แล้ว ไม่ต้องใช้ที่นั่งโปรโมชันเพิ่ม (กันนับซ้ำจากออเดอร์ค้างหลายรายการ)
        const alreadyLocked = await tx.subscription.findFirst({
          where: { userId: order.userId, planId: order.planId, isPriceLocked: true, status: { not: "REVOKED" } },
          select: { id: true },
        });
        let promoOversold = false;
        if (order.priceReason === "PROMO" && !alreadyLocked) {
          const plan = await tx.plan.update({ where: { id: order.planId }, data: { promoEnrolledCount: { increment: 1 } } });
          promoOversold = plan.promoLimit !== null && plan.promoEnrolledCount > plan.promoLimit;
        }
        const basePrice = order.basePrice?.toNumber() ?? Math.ceil(order.amount.toNumber());
        const isPriceLocked = order.plan.lockPriceForLife && (order.priceReason === "PROMO" || order.priceReason === "LOCKED" || Boolean(alreadyLocked));

        await tx.payment.update({ where: { orderId: order.id }, data: { referenceNo, verifiedAt: now } });
        await tx.subscription.create({
          data: {
            userId: order.userId,
            planId: order.planId,
            orderId: order.id,
            status: "ACTIVE",
            currentPeriodStart: period.start,
            currentPeriodEnd: period.end,
            isPriceLocked,
            lockedPrice: isPriceLocked ? basePrice : null,
          },
        });
        await tx.order.update({ where: { id: order.id }, data: { status: "APPROVED", approvedAt: now, approvedByUserId: input.actor.id } });
        await writeAudit(tx, {
          actor: input.actor,
          action: "ORDER_APPROVE",
          targetType: "Order",
          targetId: order.id,
          details: {
            before: { status: locked.status },
            after: { status: "APPROVED" },
            orderNumber: order.orderNumber,
            amount: order.amount.toNumber(),
            referenceNo,
            periodStart: period.start.toISOString(),
            periodEnd: period.end.toISOString(),
            isPriceLocked,
            promoOversold,
          },
        });

        return {
          ok: true,
          orderNumber: order.orderNumber,
          email: order.user.email,
          planName: order.plan.name,
          amount: order.amount.toNumber(),
          periodStart: period.start,
          periodEnd: period.end,
          promoOversold,
        };
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );
  } catch (error) {
    // เลขอ้างอิงเดียวกันถูกใช้อนุมัติอีกออเดอร์พร้อมกัน และอีกฝั่ง commit ก่อน
    if (isUniqueViolation(error)) return { ok: false, code: "DUPLICATE_REFERENCE" };
    throw error;
  }
}

/** ปฏิเสธสลิป (Flow 4.3) — ลูกค้าแนบสลิปใบใหม่ได้ แต่สลิปเดิมยังถูกบล็อกถาวร */
export async function rejectOrder(
  db: PrismaClient,
  input: { orderId: string; actor: ActorContext; reason: string; now?: Date },
): Promise<RejectResult> {
  const now = input.now ?? new Date();
  const reason = normalizeReason(input.reason);
  if (!reason) return { ok: false, code: "REASON_REQUIRED" };

  return db.$transaction(
    async (tx): Promise<RejectResult> => {
      const locked = await lockOrder(tx, input.orderId);
      if (!locked) return { ok: false, code: "ORDER_NOT_FOUND" };
      if (locked.status !== "SLIP_SUBMITTED") return { ok: false, code: "NOT_PENDING_REVIEW" };

      const order = await tx.order.update({
        where: { id: input.orderId },
        data: { status: "REJECTED", rejectedAt: now, rejectionReason: reason },
        select: { orderNumber: true, user: { select: { email: true } } },
      });
      await writeAudit(tx, {
        actor: input.actor,
        action: "ORDER_REJECT",
        targetType: "Order",
        targetId: input.orderId,
        details: { before: { status: locked.status }, after: { status: "REJECTED" }, orderNumber: order.orderNumber, reason },
      });
      return { ok: true, orderNumber: order.orderNumber, email: order.user.email, reason };
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

/** คืนเงิน (Flow 7.2) — คืนได้ครั้งเดียว, ไม่เกินยอดที่จ่าย, ปิดสิทธิ์ของออเดอร์นั้นทันที */
export async function refundOrder(
  db: PrismaClient,
  input: { orderId: string; actor: ActorContext; amount: number; reason: string; transferReference?: string; now?: Date },
): Promise<RefundResult> {
  const now = input.now ?? new Date();
  const reason = normalizeReason(input.reason);
  const cents = Math.round(input.amount * 100);

  try {
    return await db.$transaction(
      async (tx): Promise<RefundResult> => {
        const locked = await lockOrder(tx, input.orderId);
        if (!locked) return { ok: false, code: "ORDER_NOT_FOUND" };
        if (locked.status !== "APPROVED") return { ok: false, code: "NOT_REFUNDABLE" };

        const order = await tx.order.findUniqueOrThrow({
          where: { id: input.orderId },
          select: { orderNumber: true, amount: true, userId: true, user: { select: { email: true } } },
        });
        if (!Number.isFinite(input.amount) || cents <= 0 || cents > Math.round(order.amount.toNumber() * 100)) {
          return { ok: false, code: "INVALID_AMOUNT" };
        }
        if (!reason) return { ok: false, code: "REASON_REQUIRED" };

        const amount = cents / 100;
        const transferReference = input.transferReference?.trim() || null;
        await tx.refund.create({
          data: { orderId: input.orderId, amount, reason, processedByUserId: input.actor.id, transferReference },
        });
        await tx.order.update({ where: { id: input.orderId }, data: { status: "REFUNDED" } });
        // ล็อกตามลำดับเดียวกับการอนุมัติ (แถวออเดอร์ → สมาชิก) เพื่อไม่ให้ชนกับการอนุมัติออเดอร์อื่นของคนเดียวกัน
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`membership:${order.userId}`}))`;
        const affected = await tx.subscription.findMany({
          where: { orderId: input.orderId, status: { in: ["ACTIVE", "EXPIRING_SOON"] } },
          select: { id: true, status: true, currentPeriodStart: true, currentPeriodEnd: true, tradingViewGranted: true, discordRoleGranted: true, telegramGranted: true },
        });
        const revoked = await tx.subscription.updateMany({
          where: { id: { in: affected.map((subscription) => subscription.id) } },
          data: { status: "REVOKED", revokedAt: now, revocationReason: `คืนเงิน: ${reason}` },
        });
        // ช่วงสิทธิ์ที่ต่อทบไว้หลังจากนี้เลื่อนเข้ามา ไม่ให้ลูกค้าที่จ่ายช่วงถัดไปเข้าใช้ไม่ได้
        const periodsMoved = await repackFutureSegments(tx, { userId: order.userId, now });
        // ถ้าสมาชิกยังมีช่วงที่จ่ายไว้ต่อ ช่องทางที่เปิดไว้ต้องคงอยู่ → ย้ายสถานะไปช่วงปัจจุบัน ไม่ให้ถูกนับว่าต้องถอด
        const carried = await carryOverProvisioning(tx, { userId: order.userId, fromIds: affected.map((subscription) => subscription.id), now });
        const continuing = (await tx.subscription.count({
          where: { userId: order.userId, status: { in: ["ACTIVE", "EXPIRING_SOON"] }, currentPeriodStart: { lte: now }, currentPeriodEnd: { gt: now } },
        })) > 0;
        await writeAudit(tx, {
          actor: input.actor,
          action: "ORDER_REFUND",
          targetType: "Order",
          targetId: input.orderId,
          details: {
            before: { status: locked.status },
            after: { status: "REFUNDED" },
            orderNumber: order.orderNumber,
            amount,
            reason,
            transferReference,
            subscriptionsRevoked: revoked.count,
            revokedSubscriptions: affected.map((subscription) => ({
              ...subscription,
              currentPeriodStart: subscription.currentPeriodStart.toISOString(),
              currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
            })),
            periodsMoved,
            continuing,
            carriedOver: carried ? { toSubscriptionId: carried.toSubscriptionId, channels: carried.channels } : null,
          },
        });
        return { ok: true, orderNumber: order.orderNumber, email: order.user.email, amount, continuing };
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );
  } catch (error) {
    // คืนเงินออเดอร์เดียวกันพร้อมกัน — Refund.orderId เป็น unique
    if (isUniqueViolation(error)) return { ok: false, code: "NOT_REFUNDABLE" };
    throw error;
  }
}
