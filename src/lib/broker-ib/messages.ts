import { formatDate } from "@/lib/format";
import type { CreateBrokerClaimResult } from "./claims";
import { BROKER_IB_RULES } from "@/config/broker-ib";

type ClaimFailureCode = Extract<CreateBrokerClaimResult, { ok: false }>["code"];

export type BrokerClaimErrorCode = ClaimFailureCode | "INVALID_BROKER" | "CONFIRM_REQUIRED" | "TERMS_REQUIRED" | "RATE_LIMITED" | "UNEXPECTED";

const MESSAGES: Record<BrokerClaimErrorCode, string> = {
  IB_CLOSED: "ขณะนี้ยังไม่เปิดรับคำขอสิทธิ์ผ่านโบรกเกอร์ — ใช้งานแบบชำระเงินได้ที่หน้าแพ็กเกจ",
  BROKER_NOT_OFFERED: "โบรกเกอร์นี้ยังไม่เปิดให้ยื่นขอสิทธิ์",
  INVALID_BROKER: "กรุณาเลือกโบรกเกอร์และแพลตฟอร์ม (MT4 / MT5)",
  INVALID_ACCOUNT_NUMBER: "เลขบัญชีเทรด (MT4/MT5 Login) ต้องเป็นตัวเลข 5–12 หลัก",
  INVALID_EMAIL: "อีเมลที่ใช้สมัครกับโบรกเกอร์ไม่ถูกต้อง",
  ACCOUNT_CLAIMED: "บัญชีเทรดนี้ถูกใช้ยื่นขอสิทธิ์แล้ว หากเป็นบัญชีของคุณ กรุณาติดต่อทีมงานพร้อมหลักฐาน",
  ALREADY_HAS_ACCOUNT: "บัญชีสมาชิกนี้ผูกกับบัญชีเทรดอื่นอยู่แล้ว หากต้องการเปลี่ยน กรุณาติดต่อทีมงาน",
  NO_VERIFIED_ACCOUNT: "ยังไม่มีบัญชีเทรดที่ผ่านการตรวจสอบ กรุณายื่นเลขบัญชีก่อน",
  CLAIM_ALREADY_PENDING: "คุณมีคำขอที่รอทีมงานตรวจสอบอยู่แล้ว",
  NOT_IN_RENEWAL_WINDOW: `คุณยังมีสิทธิ์ใช้งานเหลือมากกว่า ${BROKER_IB_RULES.renewalWindowDays} วัน`,
  CONFIRM_REQUIRED: "กรุณายืนยันว่าเปิดบัญชีผ่านลิงก์ของเราและฝากเงินครบขั้นต่ำแล้ว",
  TERMS_REQUIRED: "กรุณายอมรับข้อกำหนดการใช้บริการก่อนยื่นคำขอ",
  RATE_LIMITED: "ยื่นคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
  UNEXPECTED: "เกิดข้อผิดพลาดที่ไม่คาดคิด ระบบบันทึกไว้แล้ว — ลองใหม่อีกครั้ง",
};

export function brokerClaimErrorMessage(code: BrokerClaimErrorCode, opensAt?: Date): string {
  if (code === "NOT_IN_RENEWAL_WINDOW" && opensAt) return `${MESSAGES[code]} ยื่นคำขอได้ตั้งแต่วันที่ ${formatDate(opensAt)}`;
  return MESSAGES[code];
}

export const BROKER_CLAIM_SUCCESS_MESSAGE = "ส่งคำขอแล้ว ทีมงานจะตรวจสอบบัญชีใน Partner Portal ของโบรกเกอร์และแจ้งผลทางอีเมล";

/** เหตุผลปฏิเสธที่ใช้บ่อย (แอดมินเลือกแล้วเพิ่มรายละเอียดได้) */
export const BROKER_REJECTION_PRESETS = [
  "ไม่พบบัญชีภายใต้ IB ของเรา",
  "ยอดฝากครั้งแรกยังไม่ถึงขั้นต่ำ",
  "อีเมลไม่ตรงกับบัญชีในระบบโบรกเกอร์",
  "เลขบัญชีไม่ถูกต้อง",
  "บัญชีไม่อยู่ภายใต้ IB แล้ว / ไม่มีความเคลื่อนไหว",
  `สมาชิกยังมีสิทธิ์เหลือมากกว่า ${BROKER_IB_RULES.renewalWindowDays} วัน`,
] as const;
