import type { Prisma, PrismaClient } from "@prisma/client";
import { PAYMENT_RULES } from "@/config/payment";
import { buildPromptPayPayload } from "@/lib/payments/promptpay";
import { applySatangDiscount, pickSatangDiscount, quotePlanPrice, type PriceQuote } from "@/lib/payments/pricing";
import { generateOrderNumber, type OrderNumberPrefix } from "@/lib/security";
import { getPaymentAvailability } from "./availability";

type Tx = Prisma.TransactionClient;

export type CreateOrderResult =
  | { ok: true; orderId: string; reused: boolean }
  | { ok: false; code: "PAYMENTS_CLOSED" | "PLAN_NOT_FOUND" | "TOO_MANY_OPEN_ORDERS" | "PRICE_CHANGED" | "CHECKOUT_BUSY" };

interface CreateOrderInput {
  userId: string;
  planSlug: string;
  now?: Date;
  /** ราคาที่ผู้ใช้เห็นในหน้ายืนยัน — ถ้าราคาเปลี่ยนระหว่างนั้นจะไม่สร้างออเดอร์ */
  expectedBasePrice?: number;
  /** เวอร์ชันข้อกำหนดที่ผู้ใช้กดยอมรับ (วันที่มีผล) */
  termsVersion?: string;
  ipAddress?: string;
  /** ใช้ในเทสต์เพื่อกำหนดผลสุ่มเศษสตางค์ */
  random?: () => number;
}

const toCents = (amount: number) => Math.round(amount * 100);

const MINUTE_MS = 60 * 1000;
const GRACE_MS = PAYMENT_RULES.slipUploadGraceMinutes * MINUTE_MS;
const ORDER_NUMBER_ATTEMPTS = 5;
const TRANSACTION_TIMEOUT_MS = 10_000;

/** เปลี่ยนออเดอร์ที่เลยเวลาแนบสลิปแล้วเป็น EXPIRED */
export async function expireStaleOrders(tx: Tx, { userId, now }: { userId?: string; now: Date }): Promise<number> {
  const { count } = await tx.order.updateMany({
    where: { status: "PENDING_PAYMENT", expiresAt: { lte: new Date(now.getTime() - GRACE_MS) }, ...(userId ? { userId } : {}) },
    data: { status: "EXPIRED" },
  });
  return count;
}

async function findLockedPrice(tx: Tx, userId: string, planId: string): Promise<number | null> {
  const locked = await tx.subscription.findFirst({
    where: { userId, planId, isPriceLocked: true, lockedPrice: { not: null }, status: { not: "REVOKED" } },
    orderBy: { createdAt: "desc" },
    select: { lockedPrice: true },
  });
  return locked?.lockedPrice?.toNumber() ?? null;
}

/** เศษสตางค์ที่ออเดอร์ค้างอื่น (ราคาเดียวกัน) ใช้อยู่ */
async function findTakenSatang(tx: Tx, basePrice: number, now: Date): Promise<Set<number>> {
  const { min, max } = PAYMENT_RULES.satangDiscountRange;
  const openOrders = await tx.order.findMany({
    where: {
      amount: { gte: (Math.round(basePrice * 100) - max) / 100, lte: (Math.round(basePrice * 100) - min) / 100 },
      OR: [{ status: "SLIP_SUBMITTED" }, { status: "PENDING_PAYMENT", expiresAt: { gt: new Date(now.getTime() - GRACE_MS) } }],
    },
    select: { amount: true },
  });
  return new Set(openOrders.map(({ amount }) => Math.round(basePrice * 100) - Math.round(amount.toNumber() * 100)));
}

function toPricingPlan(plan: { price: Prisma.Decimal; originalPrice: Prisma.Decimal | null; isPromo: boolean; promoLimit: number | null; promoEnrolledCount: number }) {
  return {
    price: plan.price.toNumber(),
    originalPrice: plan.originalPrice?.toNumber() ?? null,
    isPromo: plan.isPromo,
    promoLimit: plan.promoLimit,
    promoEnrolledCount: plan.promoEnrolledCount,
  };
}

export interface CheckoutQuote {
  plan: { id: string; slug: string; name: string; durationDays: number; features: string[]; originalPrice: number | null };
  quote: PriceQuote;
}

/** ราคาที่ผู้ใช้คนนี้จะได้ (ใช้แสดงในหน้า Checkout ก่อนสร้างออเดอร์) — คืน null ถ้าไม่มีแพ็กเกจ */
export async function quoteForUser(db: PrismaClient, { userId, planSlug }: { userId: string; planSlug: string }): Promise<CheckoutQuote | null> {
  // สิทธิ์ผ่าน IB (ราคา 0) ห้ามเข้า Checkout — ไม่งั้นจะได้ออเดอร์ PromptPay 0 บาท
  const plan = await db.plan.findFirst({ where: { slug: planSlug, isActive: true, kind: "PAID" } });
  if (!plan) return null;
  return {
    plan: {
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      durationDays: plan.durationDays,
      features: plan.features,
      originalPrice: plan.originalPrice?.toNumber() ?? null,
    },
    quote: quotePlanPrice(toPricingPlan(plan), await findLockedPrice(db, userId, plan.id)),
  };
}

export async function uniqueOrderNumber(tx: Tx, now: Date, prefix: OrderNumberPrefix = "ORD"): Promise<string> {
  for (let attempt = 0; attempt < ORDER_NUMBER_ATTEMPTS; attempt++) {
    const candidate = generateOrderNumber(now, prefix);
    if (!(await tx.order.findUnique({ where: { orderNumber: candidate }, select: { id: true } }))) return candidate;
  }
  throw new Error("Could not generate a unique order number");
}

/**
 * สร้างออเดอร์ PENDING_PAYMENT พร้อม PromptPay QR (Flow 2 ใน docs/PLAN.md)
 * - ใช้ advisory lock ต่อผู้ใช้ กันการกดซ้ำพร้อมกัน (Idempotency): ออเดอร์แพ็กเกจเดิมที่ยังไม่หมดเวลาจะถูกนำกลับมาใช้
 * - จำกัดจำนวนออเดอร์ค้างต่อผู้ใช้
 */
export async function createOrder(db: PrismaClient, input: CreateOrderInput): Promise<CreateOrderResult> {
  const now = input.now ?? new Date();
  const availability = await getPaymentAvailability(db);
  if (!availability.open) return { ok: false, code: "PAYMENTS_CLOSED" };

  const plan = await db.plan.findFirst({ where: { slug: input.planSlug, isActive: true, kind: "PAID" } });
  if (!plan) return { ok: false, code: "PLAN_NOT_FOUND" };

  return db.$transaction(
    async (tx): Promise<CreateOrderResult> => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`create-order:${input.userId}`}))`;
      await expireStaleOrders(tx, { userId: input.userId, now });

      const reusable = await tx.order.findFirst({
        where: { userId: input.userId, planId: plan.id, status: "PENDING_PAYMENT", expiresAt: { gt: now } },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (reusable) return { ok: true, orderId: reusable.id, reused: true };

      const openCount = await tx.order.count({
        where: { userId: input.userId, kind: "PAID", status: { in: ["PENDING_PAYMENT", "SLIP_SUBMITTED"] } },
      });
      if (openCount >= PAYMENT_RULES.maxOpenOrdersPerUser) return { ok: false, code: "TOO_MANY_OPEN_ORDERS" };

      const quote = quotePlanPrice(toPricingPlan(plan), await findLockedPrice(tx, input.userId, plan.id));
      if (input.expectedBasePrice !== undefined && toCents(input.expectedBasePrice) !== toCents(quote.basePrice)) {
        return { ok: false, code: "PRICE_CHANGED" };
      }

      // lock ต่อราคา (ข้ามผู้ใช้) ให้การเลือกเศษสตางค์ของคนที่สั่งราคาเดียวกันพร้อมกันเกิดทีละคน
      // ลำดับ lock คงที่เสมอ (ผู้ใช้ → ราคา) จึงไม่เกิด deadlock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`satang:${toCents(quote.basePrice)}`}))`;
      const satang = pickSatangDiscount(await findTakenSatang(tx, quote.basePrice, now), input.random);
      if (satang === null) return { ok: false, code: "CHECKOUT_BUSY" };
      const amount = applySatangDiscount(quote.basePrice, satang);

      const order = await tx.order.create({
        data: {
          orderNumber: await uniqueOrderNumber(tx, now),
          userId: input.userId,
          planId: plan.id,
          amount,
          basePrice: quote.basePrice,
          priceReason: quote.reason,
          status: "PENDING_PAYMENT",
          expiresAt: new Date(now.getTime() + PAYMENT_RULES.paymentWindowMinutes * MINUTE_MS),
          termsAcceptedAt: input.termsVersion ? now : null,
          termsVersion: input.termsVersion ?? null,
          createdIp: input.ipAddress ?? null,
          payment: {
            create: {
              method: "PROMPTPAY_QR",
              promptpayTarget: availability.target,
              promptpayAccountName: availability.accountName,
              promptpayPayload: buildPromptPayPayload(availability.target, amount),
              amount,
            },
          },
        },
        select: { id: true },
      });
      return { ok: true, orderId: order.id, reused: false };
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}
