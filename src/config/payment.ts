/**
 * กติกาการชำระเงินและอายุสมาชิก (ตาม Flow 2, 3, 6 ใน docs/PLAN.md)
 * ใช้ร่วมกันทั้งหน้าคู่มือ หน้านโยบาย และระบบ Checkout ใน Phase 3 — แก้ที่นี่ที่เดียว
 */
export const PAYMENT_RULES = {
  /** เวลาที่ออเดอร์รอชำระเงินก่อนหมดอายุ */
  paymentWindowMinutes: 30,
  /** ขนาดไฟล์สลิปสูงสุด */
  slipMaxSizeMb: 5,
  /** ชนิดไฟล์สลิปที่รับ (ตรวจด้วย MIME + Magic Bytes ใน Phase 3) */
  slipAllowedFormats: ["JPG", "PNG", "WebP"],
  /** แจ้งเตือนก่อนสิทธิ์หมดอายุกี่วัน */
  expiryReminderDays: 3,
} as const;
