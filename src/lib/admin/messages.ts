import type { ApproveResult, RefundResult, RejectResult } from "./order-review";
import type { RevokeResult } from "./members";
import type { SettingsResult } from "./settings";

type FailureCode<T> = T extends { ok: false; code: infer C } ? C : never;

export type AdminErrorCode =
  | FailureCode<ApproveResult>
  | FailureCode<RejectResult>
  | FailureCode<RefundResult>
  | FailureCode<RevokeResult>
  | FailureCode<SettingsResult>
  | "FORBIDDEN"
  | "CONFIRM_REQUIRED"
  | "UNEXPECTED";

export const ADMIN_ERROR_MESSAGES: Record<AdminErrorCode, string> = {
  ORDER_NOT_FOUND: "ไม่พบคำสั่งซื้อนี้",
  NOT_PENDING_REVIEW: "คำสั่งซื้อนี้ไม่ได้อยู่ในสถานะรอตรวจสลิปแล้ว (อาจมีแอดมินคนอื่นดำเนินการไปแล้ว) — รีเฟรชหน้าเพื่อดูสถานะล่าสุด",
  REFERENCE_REQUIRED: "กรุณากรอกเลขอ้างอิงธุรกรรมจากสลิป",
  INVALID_REFERENCE: "เลขอ้างอิงต้องเป็นตัวอักษรภาษาอังกฤษหรือตัวเลข 4–64 ตัว",
  DUPLICATE_REFERENCE: "เลขอ้างอิงนี้เคยใช้อนุมัติคำสั่งซื้ออื่นแล้ว — สลิปนี้อาจถูกนำมาใช้ซ้ำ ห้ามอนุมัติ",
  SELF_APPROVAL: "ห้ามอนุมัติคำสั่งซื้อของตัวเอง — ให้แอดมินคนอื่นเป็นผู้ตรวจ",
  REASON_REQUIRED: "กรุณาระบุเหตุผล (2–300 ตัวอักษร)",
  NOT_REFUNDABLE: "คืนเงินได้เฉพาะคำสั่งซื้อที่อนุมัติแล้วและยังไม่เคยคืนเงิน",
  INVALID_AMOUNT: "ยอดคืนเงินต้องมากกว่า 0 และไม่เกินยอดที่ลูกค้าชำระ",
  MEMBER_NOT_FOUND: "ไม่พบสมาชิกนี้",
  INVALID_PROMPTPAY: "เลข PromptPay ไม่ถูกต้อง (เบอร์มือถือ 10 หลัก, เลขประจำตัว 13 หลัก หรือ e-Wallet 15 หลัก) — ต้องกรอกก่อนเปิดรับเงิน",
  ACCOUNT_NAME_REQUIRED: "กรุณากรอกชื่อบัญชีผู้รับก่อนเปิดรับเงิน",
  FORBIDDEN: "บัญชีนี้ไม่มีสิทธิ์แอดมิน",
  CONFIRM_REQUIRED: "กรุณาติ๊กยืนยันก่อนดำเนินการ",
  UNEXPECTED: "เกิดข้อผิดพลาดที่ไม่คาดคิด ระบบบันทึกไว้แล้ว — ลองใหม่อีกครั้ง",
};

export function adminErrorMessage(code: AdminErrorCode): string {
  return ADMIN_ERROR_MESSAGES[code];
}

/** เหตุผลปฏิเสธสลิปที่ใช้บ่อย (แอดมินเลือกแล้วเพิ่มรายละเอียดได้) */
export const REJECTION_PRESETS = [
  "ยอดเงินในสลิปไม่ตรงกับคำสั่งซื้อ",
  "บัญชีผู้รับในสลิปไม่ถูกต้อง",
  "สลิปไม่ชัด อ่านข้อมูลไม่ได้",
  "ไม่พบยอดเงินเข้าบัญชี",
  "สลิปนี้เคยถูกใช้แล้ว / สงสัยว่าปลอมแปลง",
] as const;
