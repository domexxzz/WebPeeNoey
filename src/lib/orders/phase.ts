import type { OrderStatus } from "@prisma/client";
import { PAYMENT_RULES } from "@/config/payment";

/**
 * สถานะที่ผู้ใช้เห็น (คำนวณจากสถานะในฐานข้อมูล + เวลา)
 * - AWAITING_PAYMENT: แสดง QR ให้สแกนจ่าย
 * - SLIP_GRACE: หมดเวลาชำระแล้ว แต่ยังแนบสลิปได้ (เผื่อโอนในนาทีสุดท้าย)
 */
export type OrderPhase =
  | "AWAITING_PAYMENT"
  | "SLIP_GRACE"
  | "EXPIRED"
  | "SLIP_SUBMITTED"
  | "CLAIM_SUBMITTED"
  | "REJECTED"
  | "APPROVED"
  | "REFUNDED";

const GRACE_MS = PAYMENT_RULES.slipUploadGraceMinutes * 60 * 1000;

export function slipDeadline(expiresAt: Date): Date {
  return new Date(expiresAt.getTime() + GRACE_MS);
}

export function computeOrderPhase(order: { status: OrderStatus; expiresAt: Date }, now: Date): OrderPhase {
  if (order.status !== "PENDING_PAYMENT") return order.status;
  if (now < order.expiresAt) return "AWAITING_PAYMENT";
  if (now < slipDeadline(order.expiresAt)) return "SLIP_GRACE";
  return "EXPIRED";
}

/** ออเดอร์ที่ยังรับสลิปได้ — ออเดอร์ที่ถูกปฏิเสธแนบสลิปใบใหม่ได้เสมอ เพราะลูกค้าโอนเงินไปแล้ว */
export function acceptsSlip(phase: OrderPhase): boolean {
  return phase === "AWAITING_PAYMENT" || phase === "SLIP_GRACE" || phase === "REJECTED";
}
