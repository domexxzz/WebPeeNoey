/**
 * ค่าที่ใช้ในหน้านโยบาย (Terms / Privacy / Refund)
 *
 * ⚠️ ทุกค่าในไฟล์นี้เป็นนโยบายทางธุรกิจ/กฎหมาย ต้องให้เจ้าของธุรกิจยืนยัน
 * และควรให้ผู้เชี่ยวชาญด้านกฎหมายตรวจทานก่อนเปิดใช้งานจริง
 * เมื่อยืนยันครบแล้วให้เปลี่ยน isDraft เป็น false
 */

import { PAYMENT_RULES } from "./payment";

const operatorName = process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME?.trim() || "";
const operatorAddress = process.env.NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS?.trim() || "";

export const UNSET_LEGAL_VALUE = "[รอระบุโดยผู้ให้บริการ]";

export const legalConfig = {
  isDraft: true,
  effectiveDate: "2026-10-15",
  operatorName: operatorName || UNSET_LEGAL_VALUE,
  operatorAddress: operatorAddress || UNSET_LEGAL_VALUE,
  /** อายุขั้นต่ำของผู้ใช้บริการ (บรรลุนิติภาวะตามกฎหมายไทย) */
  minimumAge: 20,
  /** ระยะเวลาที่ลูกค้ายื่นขอคืนเงินได้ นับจากวันที่ออเดอร์ได้รับอนุมัติ */
  refundRequestWindowDays: 7,
  /** ระยะเวลาดำเนินการโอนเงินคืน นับจากวันที่อนุมัติคำขอคืนเงิน */
  refundProcessingDays: 7,
  paymentWindowMinutes: PAYMENT_RULES.paymentWindowMinutes,
  expiryReminderDays: PAYMENT_RULES.expiryReminderDays,
  retention: {
    account: "ตลอดระยะเวลาที่เป็นสมาชิก และไม่เกิน 1 ปีหลังปิดบัญชี",
    payment: "5 ปี นับจากวันที่ชำระเงิน ตามหน้าที่เก็บเอกสารทางบัญชีและภาษี",
    securityLogs: "ไม่เกิน 1 ปี เว้นแต่จำเป็นต่อการตรวจสอบเหตุผิดปกติหรือข้อพิพาท",
  },
} as const;

export function formatThaiDate(isoDate: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${isoDate}T00:00:00+07:00`));
}
