import type { OrderStatus, PrismaClient } from "@prisma/client";
import { getPaymentAvailability, type PaymentAvailability } from "./availability";
import { expireStaleOrders } from "./create-order";
import { computeOrderPhase, slipDeadline, type OrderPhase } from "./phase";

/** ข้อมูลออเดอร์ที่ส่งให้หน้าเว็บ (แปลง Decimal เป็น number แล้ว ส่งให้ Client Component ได้) */
export interface OrderView {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  phase: OrderPhase;
  amount: number;
  planName: string;
  planSlug: string;
  planDurationDays: number;
  createdAt: Date;
  expiresAt: Date;
  slipDeadline: Date;
  slipUploadedAt: Date | null;
  rejectionReason: string | null;
  /** แสดงเฉพาะช่วงที่ยังจ่ายได้และบัญชีรับเงินยังเป็นบัญชีเดิม */
  promptpayPayload: string | null;
  /** ชื่อบัญชีผู้รับ ณ เวลาสร้าง QR — แสดงคู่กับ QR เสมอ */
  promptpayAccountName: string;
  /** ระงับการจ่ายชั่วคราว: ปิดรับเงินแล้ว หรือเปลี่ยนบัญชี PromptPay หลังสร้าง QR */
  paymentSuspended: boolean;
}

const ORDER_INCLUDE = {
  plan: { select: { name: true, slug: true, durationDays: true } },
  payment: { select: { promptpayPayload: true, promptpayTarget: true, promptpayAccountName: true } },
} as const;

type OrderWithRelations = Awaited<ReturnType<PrismaClient["order"]["findFirstOrThrow"]>> & {
  plan: { name: string; slug: string; durationDays: number };
  payment: { promptpayPayload: string; promptpayTarget: string; promptpayAccountName: string } | null;
};

/** ออเดอร์ที่เลยเวลาแนบสลิปจะถูกบันทึกเป็น EXPIRED ทันทีที่มีคนเปิดดู (ไม่ต้องรอ Cron) */
async function persistExpiry(db: PrismaClient, orderId: string, phase: OrderPhase, status: OrderStatus): Promise<OrderStatus> {
  if (phase !== "EXPIRED" || status !== "PENDING_PAYMENT") return status;
  await db.order.updateMany({ where: { id: orderId, status: "PENDING_PAYMENT" }, data: { status: "EXPIRED" } });
  return "EXPIRED";
}

function toView(order: OrderWithRelations, status: OrderStatus, phase: OrderPhase, availability: PaymentAvailability): OrderView {
  const payment = order.payment;
  const accountChanged = !availability.open || !payment || availability.target !== payment.promptpayTarget;
  const paymentSuspended = phase === "AWAITING_PAYMENT" && accountChanged;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status,
    phase,
    amount: order.amount.toNumber(),
    planName: order.plan.name,
    planSlug: order.plan.slug,
    planDurationDays: order.plan.durationDays,
    createdAt: order.createdAt,
    expiresAt: order.expiresAt,
    slipDeadline: slipDeadline(order.expiresAt),
    slipUploadedAt: order.slipUploadedAt,
    rejectionReason: order.rejectionReason,
    promptpayPayload: phase === "AWAITING_PAYMENT" && !paymentSuspended ? (payment?.promptpayPayload ?? null) : null,
    promptpayAccountName: payment?.promptpayAccountName ?? "",
    paymentSuspended,
  };
}

/** คืน null ถ้าไม่พบหรือไม่ใช่เจ้าของ (ไม่บอกว่าออเดอร์นี้มีอยู่จริงหรือไม่) */
export async function getOrderForUser(
  db: PrismaClient,
  { userId, orderId, now = new Date() }: { userId: string; orderId: string; now?: Date },
): Promise<OrderView | null> {
  // คำขอสิทธิ์ผ่าน IB ไม่มีหน้าชำระเงิน — ดูที่ /account/broker-ib
  const order = await db.order.findFirst({ where: { id: orderId, userId, kind: "PAID" }, include: ORDER_INCLUDE });
  if (!order) return null;
  const phase = computeOrderPhase(order, now);
  const status = await persistExpiry(db, order.id, phase, order.status);
  return toView(order, status, phase, await getPaymentAvailability(db));
}

export async function listOrdersForUser(
  db: PrismaClient,
  { userId, now = new Date(), take = 50 }: { userId: string; now?: Date; take?: number },
): Promise<OrderView[]> {
  // อัปเดตออเดอร์หมดอายุของผู้ใช้ครั้งเดียว แทนการเขียนทีละแถวตอนแสดงรายการ
  await expireStaleOrders(db, { userId, now });
  const [orders, availability] = await Promise.all([
    db.order.findMany({ where: { userId, kind: "PAID" }, include: ORDER_INCLUDE, orderBy: { createdAt: "desc" }, take }),
    getPaymentAvailability(db),
  ]);
  return orders.map((order) => toView(order, order.status, computeOrderPhase(order, now), availability));
}
