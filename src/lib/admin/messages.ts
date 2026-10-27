import type { ApproveResult, RefundResult, RejectResult } from "./order-review";
import type { RevokeResult } from "./members";
import type { SettingsResult } from "./settings";
import type { BrokerIbSettingsResult } from "@/lib/broker-ib/settings";
import type { ApproveBrokerClaimResult, RejectBrokerClaimResult, ReleaseBrokerAccountResult, RevokeBrokerAccessResult } from "@/lib/broker-ib/review";
import { BROKER_IB_RULES } from "@/config/broker-ib";

type FailureCode<T> = T extends { ok: false; code: infer C } ? C : never;

export type AdminErrorCode =
  | FailureCode<ApproveResult>
  | FailureCode<RejectResult>
  | FailureCode<RefundResult>
  | FailureCode<RevokeResult>
  | FailureCode<SettingsResult>
  | FailureCode<BrokerIbSettingsResult>
  | FailureCode<ApproveBrokerClaimResult>
  | FailureCode<RejectBrokerClaimResult>
  | FailureCode<RevokeBrokerAccessResult>
  | FailureCode<ReleaseBrokerAccountResult>
  | "FORBIDDEN"
  | "CONFIRM_REQUIRED"
  | "INVALID_REPORT_FILE"
  | "SELF_ROLE_CHANGE"
  | "ALREADY_THAT_ROLE"
  | "LAST_ADMIN"
  | "INVALID_ROLE"
  | "ACTOR_NOT_ADMIN"
  | "UNEXPECTED";

export const ADMIN_ERROR_MESSAGES: Record<AdminErrorCode, string> = {
  INVALID_REPORT_FILE: "ไฟล์รายงานที่อัปโหลดใช้ไม่ได้",
  SELF_ROLE_CHANGE: "เปลี่ยนสิทธิ์ของตัวเองไม่ได้ — ให้แอดมินอีกคนเป็นผู้เปลี่ยนให้",
  ALREADY_THAT_ROLE: "สมาชิกคนนี้มีสิทธิ์ระดับนี้อยู่แล้ว",
  LAST_ADMIN: "ลดสิทธิ์แอดมินคนสุดท้ายไม่ได้ — ต้องเหลือแอดมินอย่างน้อยหนึ่งคน",
  INVALID_ROLE: "ระดับสิทธิ์ไม่ถูกต้อง",
  ACTOR_NOT_ADMIN: "สิทธิ์แอดมินของคุณถูกเพิกถอนระหว่างสั่งงาน — คำสั่งนี้ไม่ถูกบันทึก",
  ORDER_NOT_FOUND: "ไม่พบคำสั่งซื้อนี้",
  NOT_PENDING_REVIEW: "รายการนี้ไม่ได้อยู่ในสถานะรอตรวจแล้ว (อาจมีแอดมินคนอื่นดำเนินการไปแล้ว) — รีเฟรชหน้าเพื่อดูสถานะล่าสุด",
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
  INVALID_IB_LINK: "ลิงก์พาร์ทเนอร์ต้องขึ้นต้นด้วย https:// และไม่มีชื่อผู้ใช้/รหัสผ่านในลิงก์ (ยาวไม่เกิน 500 ตัวอักษร)",
  INVALID_MIN_DEPOSIT: "ยอดฝากขั้นต่ำต้องเป็นตัวเลข 1–1,000,000 บาท ทศนิยมไม่เกิน 2 ตำแหน่ง",
  INVALID_USD_THB_RATE: "อัตราแลกเปลี่ยน USD/THB ต้องเป็นตัวเลข 10–100 ทศนิยมไม่เกิน 2 ตำแหน่ง",
  CHECKS_REQUIRED: "ติ๊กยืนยันผลตรวจใน Partner Portal ให้ครบทุกข้อก่อนอนุมัติ",
  ACCOUNT_RELEASED: "บัญชีเทรดนี้ถูกปลดการผูกแล้ว — อนุมัติไม่ได้ (ให้สมาชิกยื่นใหม่)",
  NOT_IN_RENEWAL_WINDOW: `สมาชิกยังมีสิทธิ์เหลือมากกว่า ${BROKER_IB_RULES.renewalWindowDays} วัน — อนุมัติไม่ได้ตอนนี้ (ปฏิเสธพร้อมเหตุผล หรือรอให้ถึงช่วงต่ออายุ)`,
  NOTHING_TO_REVOKE: "สมาชิกไม่มีสิทธิ์ผ่าน IB หรือคำขอที่รอตรวจให้ปิดแล้ว",
  BROKER_ACCOUNT_NOT_FOUND: "ไม่พบบัญชีเทรดนี้",
  ALREADY_RELEASED: "บัญชีเทรดนี้ถูกปลดการผูกไปแล้ว",
  IB_NOT_CONFIGURED: "เปิดรับคำขอได้เมื่อกรอกลิงก์พาร์ทเนอร์อย่างน้อย 1 โบรกเกอร์และยอดฝากขั้นต่ำแล้ว",
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
