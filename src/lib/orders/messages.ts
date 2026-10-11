import { PAYMENT_RULES } from "@/config/payment";
import type { PriceReason } from "@/lib/payments/pricing";
import type { CreateOrderResult } from "./create-order";
import type { OrderPhase } from "./phase";
import type { SubmitSlipResult } from "./submit-slip";

type FailureCode<T> = T extends { ok: false; code: infer C } ? C : never;

/** รหัสข้อผิดพลาดที่หน้าเว็บอาจได้รับ (จาก service + จาก server action) */
export type CheckoutErrorCode =
  | FailureCode<CreateOrderResult>
  | FailureCode<SubmitSlipResult>
  | "TERMS_REQUIRED"
  | "RATE_LIMITED"
  | "NO_FILE"
  | "UNEXPECTED";

export const CHECKOUT_ERROR_MESSAGES: Record<CheckoutErrorCode, string> = {
  PAYMENTS_CLOSED: "ขณะนี้ระบบปิดรับชำระเงินชั่วคราว กรุณาลองใหม่ภายหลัง",
  PLAN_NOT_FOUND: "ไม่พบแพ็กเกจนี้ หรือแพ็กเกจปิดการขายแล้ว",
  TOO_MANY_OPEN_ORDERS: `คุณมีคำสั่งซื้อที่ยังไม่เสร็จครบ ${PAYMENT_RULES.maxOpenOrdersPerUser} รายการแล้ว กรุณาชำระเงินหรือรอผลตรวจสอบก่อน`,
  PRICE_CHANGED: "ราคาแพ็กเกจมีการเปลี่ยนแปลง กรุณาตรวจสอบราคาใหม่แล้วยืนยันอีกครั้ง",
  CHECKOUT_BUSY: "ขณะนี้มีคำสั่งซื้อในราคานี้รอชำระจำนวนมาก กรุณาลองใหม่ในอีกไม่กี่นาที",
  TERMS_REQUIRED: "กรุณายอมรับข้อกำหนดการใช้บริการและนโยบายการคืนเงินก่อนสั่งซื้อ",
  RATE_LIMITED: "ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
  NO_FILE: "กรุณาเลือกไฟล์สลิปก่อนกดส่ง",
  EMPTY_FILE: "ไฟล์ว่างเปล่า กรุณาเลือกไฟล์สลิปใหม่",
  FILE_TOO_LARGE: `ไฟล์ใหญ่เกิน ${PAYMENT_RULES.slipMaxSizeMb}MB กรุณาส่งภาพสลิปที่เล็กลง`,
  UNSUPPORTED_TYPE: `รองรับเฉพาะไฟล์ภาพ ${PAYMENT_RULES.slipAllowedFormats.join(", ")} เท่านั้น`,
  ORDER_NOT_FOUND: "ไม่พบคำสั่งซื้อนี้",
  NOT_ACCEPTING_SLIP: "คำสั่งซื้อนี้ไม่สามารถแนบสลิปได้แล้ว หากโอนเงินไปแล้ว กรุณาติดต่อทีมงาน",
  DUPLICATE_SLIP: "สลิปนี้เคยถูกใช้งานในระบบแล้ว ไม่สามารถใช้ซ้ำได้",
  UNEXPECTED: "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง หากยังไม่ได้ กรุณาติดต่อทีมงาน",
};

export function checkoutErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  // ใช้ hasOwnProperty ไม่ใช้ `in` — "__proto__"/"constructor" จาก query string จะได้ไม่หลุดเป็น object/function
  return Object.prototype.hasOwnProperty.call(CHECKOUT_ERROR_MESSAGES, code)
    ? CHECKOUT_ERROR_MESSAGES[code as CheckoutErrorCode]
    : CHECKOUT_ERROR_MESSAGES.UNEXPECTED;
}

export type BadgeTone = "amber" | "blue" | "emerald" | "red" | "gray";

export const ORDER_PHASE_LABELS: Record<OrderPhase, { label: string; tone: BadgeTone }> = {
  AWAITING_PAYMENT: { label: "รอชำระเงิน", tone: "amber" },
  SLIP_GRACE: { label: "รอแนบสลิป", tone: "amber" },
  SLIP_SUBMITTED: { label: "รอตรวจสอบสลิป", tone: "blue" },
  REJECTED: { label: "สลิปไม่ผ่าน", tone: "red" },
  APPROVED: { label: "อนุมัติแล้ว", tone: "emerald" },
  EXPIRED: { label: "หมดอายุ", tone: "gray" },
  REFUNDED: { label: "คืนเงินแล้ว", tone: "gray" },
};

export const PRICE_REASON_LABELS: Record<PriceReason, string> = {
  LOCKED: "ราคาล็อกของคุณ",
  PROMO: "ราคาพิเศษ Early Bird",
  REGULAR: "ราคาปกติ",
};
