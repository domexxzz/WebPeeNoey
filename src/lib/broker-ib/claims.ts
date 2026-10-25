import type { Broker, BrokerAccountStatus, Prisma, PrismaClient, TradingPlatform } from "@prisma/client";
import { BROKER_IB_PLAN } from "@/config/broker-ib";
import { nextPeriodFor } from "@/lib/admin/membership";
import { isUniqueViolation } from "@/lib/admin/order-review";
import { uniqueOrderNumber } from "@/lib/orders/create-order";
import { getBrokerIbAvailability } from "./availability";
import { claimWindowOpensAt, isWithinClaimWindow } from "./rules";
import { maskAccountNumber, normalizeAccountNumber, normalizeBrokerEmail } from "./validation";

type Tx = Prisma.TransactionClient;

const TRANSACTION_TIMEOUT_MS = 10_000;
const PLATFORMS: readonly TradingPlatform[] = ["MT4", "MT5"];

export type BrokerClaimInput =
  | { mode: "NEW"; broker: Broker; platform: TradingPlatform; accountNumber: string; registeredEmail: string }
  | { mode: "RENEW" };

export type CreateBrokerClaimResult =
  | { ok: true; orderId: string; orderNumber: string; reused: boolean; isRenewal: boolean; broker: Broker; accountMasked: string }
  | {
      ok: false;
      code:
        | "IB_CLOSED"
        | "BROKER_NOT_OFFERED"
        | "INVALID_ACCOUNT_NUMBER"
        | "INVALID_EMAIL"
        | "ACCOUNT_CLAIMED"
        | "ALREADY_HAS_ACCOUNT"
        | "NO_VERIFIED_ACCOUNT"
        | "CLAIM_ALREADY_PENDING";
    }
  | { ok: false; code: "NOT_IN_RENEWAL_WINDOW"; opensAt: Date };

type ClaimFailure = Extract<CreateBrokerClaimResult, { ok: false }>;

interface CreateBrokerClaimInput {
  userId: string;
  claim: BrokerClaimInput;
  termsVersion: string;
  ipAddress?: string;
  now?: Date;
}

interface NormalizedNew {
  broker: Broker;
  platform: TradingPlatform;
  accountNumber: string;
  registeredEmail: string;
}

interface BindingRow {
  id: string;
  userId: string;
  broker: Broker;
  platform: TradingPlatform;
  accountNumber: string;
  status: BrokerAccountStatus;
  firstVerifiedAt: Date | null;
}

const ACTIVE_BINDING: BrokerAccountStatus[] = ["PENDING", "VERIFIED"];

function normalizeNew(claim: Extract<BrokerClaimInput, { mode: "NEW" }>): NormalizedNew | ClaimFailure {
  const accountNumber = normalizeAccountNumber(claim.accountNumber);
  if (!accountNumber || !PLATFORMS.includes(claim.platform)) return { ok: false, code: "INVALID_ACCOUNT_NUMBER" };
  const registeredEmail = normalizeBrokerEmail(claim.registeredEmail);
  if (!registeredEmail) return { ok: false, code: "INVALID_EMAIL" };
  return { broker: claim.broker, platform: claim.platform, accountNumber, registeredEmail };
}

/** บัญชีเทรดระบุด้วยโบรกเกอร์ + เลขบัญชี (แพลตฟอร์มเป็นข้อมูลประกอบ — บัญชีเดียวกันห้ามผูกซ้ำโดยเปลี่ยน MT4/MT5) */
export const accountLockKey = (broker: Broker, accountNumber: string) => `broker-account:${broker}:${accountNumber}`;

async function lockBinding(tx: Tx, key: { broker: Broker; accountNumber: string }): Promise<BindingRow | null> {
  const [row] = await tx.$queryRaw<BindingRow[]>`
    SELECT id, "userId", broker, platform, "accountNumber", status, "firstVerifiedAt" FROM "BrokerAccount"
    WHERE broker = ${key.broker}::"Broker" AND "accountNumber" = ${key.accountNumber}
    FOR UPDATE
  `;
  return row ?? null;
}

/**
 * บัญชีเทรดที่จะใช้กับคำขอใหม่ (ล็อกแถวแล้ว) — บังคับ 1 บัญชีต่อ 1 สมาชิก และ 1 สมาชิกต่อ 1 บัญชี
 * บัญชีที่ถูกปลดแล้ว (RELEASED) ถูกนำกลับมาใช้โดยสมาชิกคนใหม่ (unique key จึงคงอยู่ตลอด)
 */
async function bindingForNewClaim(tx: Tx, userId: string, input: NormalizedNew): Promise<BindingRow | ClaimFailure> {
  const existing = await lockBinding(tx, input);
  if (existing && existing.status !== "RELEASED" && existing.userId !== userId) return { ok: false, code: "ACCOUNT_CLAIMED" };

  const other = await tx.brokerAccount.findFirst({
    where: { userId, status: { in: ACTIVE_BINDING }, ...(existing ? { id: { not: existing.id } } : {}) },
    select: { id: true },
  });
  if (other) return { ok: false, code: "ALREADY_HAS_ACCOUNT" };

  if (!existing) {
    return tx.brokerAccount.create({
      data: { userId, broker: input.broker, platform: input.platform, accountNumber: input.accountNumber, registeredEmail: input.registeredEmail },
      select: { id: true, userId: true, broker: true, platform: true, accountNumber: true, status: true, firstVerifiedAt: true },
    });
  }
  if (existing.status === "RELEASED") {
    // คนใหม่ใช้แถวเดิม: ล้างประวัติการยืนยันของเจ้าของเดิมทั้งหมด
    return tx.brokerAccount.update({
      where: { id: existing.id },
      data: {
        userId,
        status: "PENDING",
        platform: input.platform,
        registeredEmail: input.registeredEmail,
        firstVerifiedAt: null,
        lastVerifiedAt: null,
        lastVerifiedByUserId: null,
        releasedAt: null,
        releaseReason: null,
      },
      select: { id: true, userId: true, broker: true, platform: true, accountNumber: true, status: true, firstVerifiedAt: true },
    });
  }
  // บัญชีของสมาชิกคนนี้เอง (ยื่นซ้ำหลังถูกปฏิเสธ): ยังไม่เคยยืนยัน → แก้อีเมล/แพลตฟอร์มได้
  // ยืนยันแล้ว → คงข้อมูลที่แอดมินเคยตรวจไว้ ไม่ให้เปลี่ยนอีเมลทับ
  if (existing.status === "PENDING") {
    await tx.brokerAccount.update({ where: { id: existing.id }, data: { registeredEmail: input.registeredEmail, platform: input.platform } });
  }
  return existing;
}

async function bindingForRenewal(tx: Tx, userId: string): Promise<BindingRow | ClaimFailure> {
  const verified = await tx.brokerAccount.findFirst({ where: { userId, status: "VERIFIED" }, select: { broker: true, accountNumber: true } });
  if (!verified) return { ok: false, code: "NO_VERIFIED_ACCOUNT" };
  const locked = await lockBinding(tx, verified);
  if (!locked || locked.userId !== userId || locked.status !== "VERIFIED") return { ok: false, code: "NO_VERIFIED_ACCOUNT" };
  return locked;
}

const isFailure = (value: BindingRow | ClaimFailure | NormalizedNew): value is ClaimFailure => "ok" in value;

/**
 * ยื่นคำขอสิทธิ์ผ่าน IB (ครั้งแรก หรือต่ออายุด้วยบัญชีที่ยืนยันแล้ว)
 * - ล็อกตามลำดับคงที่: สมาชิก → บัญชีเทรด (advisory) → แถว BrokerAccount — ไม่ล็อกออเดอร์ที่มีอยู่ จึงไม่ชนกับการอนุมัติ
 * - กดซ้ำ/ส่งพร้อมกัน: คืนคำขอเดิมที่ยังรอตรวจ (Idempotent)
 * - ยื่นได้เฉพาะเมื่อสิทธิ์ที่มีอยู่เหลือไม่เกิน 7 วัน (ตรวจซ้ำตอนอนุมัติ)
 * - บันทึกยอดฝากขั้นต่ำ ณ เวลายื่นไว้ในออเดอร์ แอดมินตรวจเทียบค่านี้แม้ตั้งค่าเปลี่ยนภายหลัง
 */
export async function createBrokerClaim(db: PrismaClient, input: CreateBrokerClaimInput): Promise<CreateBrokerClaimResult> {
  const now = input.now ?? new Date();
  const normalized = input.claim.mode === "NEW" ? normalizeNew(input.claim) : null;
  if (normalized && isFailure(normalized)) return normalized;

  const availability = await getBrokerIbAvailability(db);
  if (!availability.open) return { ok: false, code: "IB_CLOSED" };
  if (normalized && !availability.brokers.some((offer) => offer.broker === normalized.broker)) return { ok: false, code: "BROKER_NOT_OFFERED" };

  const plan = await db.plan.findFirst({ where: { slug: BROKER_IB_PLAN.slug, kind: "BROKER_IB", isActive: true }, select: { id: true, durationDays: true } });
  if (!plan) {
    console.error("[broker-ib] ไม่พบแพ็กเกจ broker-ib ในฐานข้อมูล — ตรวจ migration/seed");
    return { ok: false, code: "IB_CLOSED" };
  }

  try {
    return await db.$transaction(
      async (tx): Promise<CreateBrokerClaimResult> => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`broker-claim:${input.userId}`}))`;
        if (normalized) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${accountLockKey(normalized.broker, normalized.accountNumber)}))`;
        }

        const pending = await tx.order.findFirst({
          where: { userId: input.userId, kind: "BROKER_IB", status: "CLAIM_SUBMITTED" },
          select: { id: true, orderNumber: true, brokerAccount: { select: { broker: true, platform: true, accountNumber: true, firstVerifiedAt: true } } },
        });
        if (pending) {
          const account = pending.brokerAccount;
          const sameAccount = account && (!normalized || (account.broker === normalized.broker && account.accountNumber === normalized.accountNumber));
          if (!account || !sameAccount) return { ok: false, code: "CLAIM_ALREADY_PENDING" };
          return {
            ok: true,
            orderId: pending.id,
            orderNumber: pending.orderNumber,
            reused: true,
            isRenewal: account.firstVerifiedAt !== null,
            broker: account.broker,
            accountMasked: maskAccountNumber(account.accountNumber),
          };
        }

        const period = await nextPeriodFor(tx, { userId: input.userId, now, durationDays: plan.durationDays });
        if (!isWithinClaimWindow(period.start, now)) return { ok: false, code: "NOT_IN_RENEWAL_WINDOW", opensAt: claimWindowOpensAt(period.start) };

        const binding = normalized ? await bindingForNewClaim(tx, input.userId, normalized) : await bindingForRenewal(tx, input.userId);
        if (isFailure(binding)) return binding;

        // บันทึกขั้นต่ำของโบรกเกอร์นั้น ณ เวลายื่น (บาท + อัตรา + ค่าที่แปลงเป็น USD) — ใช้ตรวจแม้ตั้งค่าเปลี่ยนภายหลัง
        const offer = availability.brokers.find((candidate) => candidate.broker === binding.broker);
        if (!offer) return { ok: false, code: "BROKER_NOT_OFFERED" };

        const order = await tx.order.create({
          data: {
            orderNumber: await uniqueOrderNumber(tx, now, "IB"),
            userId: input.userId,
            planId: plan.id,
            amount: 0,
            basePrice: 0,
            status: "CLAIM_SUBMITTED",
            kind: "BROKER_IB",
            brokerAccountId: binding.id,
            ibMinDepositUsd: offer.minDepositUsd,
            ibMinDepositThb: offer.minDepositThb,
            ibUsdThbRate: availability.usdThbRate,
            // expiresAt มีผลเฉพาะออเดอร์ PENDING_PAYMENT — คำขอ IB ไม่หมดเวลาเอง
            expiresAt: now,
            termsAcceptedAt: now,
            termsVersion: input.termsVersion,
            createdIp: input.ipAddress ?? null,
          },
          select: { id: true, orderNumber: true },
        });
        return {
          ok: true,
          orderId: order.id,
          orderNumber: order.orderNumber,
          reused: false,
          isRenewal: binding.firstVerifiedAt !== null,
          broker: binding.broker,
          accountMasked: maskAccountNumber(binding.accountNumber),
        };
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );
  } catch (error) {
    // บัญชีเดียวกันถูกผูกพร้อมกัน และอีกฝั่ง commit ก่อน (กันชั้นสุดท้ายด้วย unique ในฐานข้อมูล)
    if (isUniqueViolation(error)) return { ok: false, code: "ACCOUNT_CLAIMED" };
    throw error;
  }
}
