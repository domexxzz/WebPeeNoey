/**
 * ตีความ payload ของ QR ที่ธนาคารฝังไว้ในสลิปโอนเงิน (ฟังก์ชันล้วน ไม่แตะภาพ/เน็ตเวิร์ก)
 * พอร์ตจาก Tradepulse (src/lib/slip-qr-verify.ts, extractRef ใน src/lib/slip-qr.ts)
 *
 * QR ในสลิปของไทยใช้โครงแบบ EMVCo (tag 2 หลัก + ความยาว 2 หลัก + ค่า) และปิดท้ายด้วยช่อง 91
 * ที่เก็บ CRC16-CCITT ของทุกอย่างก่อนหน้า — ธนาคารคำนวณตอนออกสลิป ใครแก้ payload checksum จะไม่ตรง
 *
 * ⚠️ checksum ตรง ≠ ของจริง: CRC16 ไม่มีกุญแจลับ ใครก็สร้าง QR ที่ checksum ตรงได้ — บอกได้แค่ว่า "รูปแบบถูก"
 * และ QR ไม่มียอดหรือบัญชีปลายทาง สิ่งที่ยืนยันได้จริงมีแค่ผลจากธนาคาร (EasySlip)
 * ค่าที่ได้: จับสลิปปลอมแบบหยาบ (ไม่มี QR / checksum ไม่ผ่าน) และใช้ payload กันสลิปเดิมที่ถ่ายใหม่
 */

/** ช่อง checksum ของสลิปโอน (QR รับเงินของ PromptPay ใช้ 63 แต่สลิปใช้ 91) */
const CRC_TAG = "9104";

/** CRC16-CCITT (poly 0x1021, init 0xFFFF) — ตัวเดียวกับที่ EMVCo กำหนด */
export function crc16ccitt(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * - VALID: มี checksum และตรง
 * - INVALID: มี checksum แต่ไม่ตรง — น่าสงสัยว่าถูกแก้ (ติดธงให้แอดมิน ไม่ปฏิเสธเอง)
 * - ABSENT: ไม่มีช่อง checksum (บางธนาคารไม่ใส่) — ตัดสินไม่ได้ ห้ามถือว่าผิด
 */
export type QrIntegrity = "VALID" | "INVALID" | "ABSENT";

export function checkQrIntegrity(payload: string | undefined | null): QrIntegrity {
  if (!payload) return "ABSENT";
  const at = payload.lastIndexOf(CRC_TAG);
  // checksum ต้องอยู่ท้ายสุดพอดี (tag 4 ตัว + ค่า 4 ตัว)
  if (at < 0 || at + 8 !== payload.length) return "ABSENT";
  const actual = payload.slice(at + 4);
  if (!/^[0-9A-Fa-f]{4}$/.test(actual)) return "ABSENT";
  return crc16ccitt(payload.slice(0, at + 4)) === actual.toUpperCase() ? "VALID" : "INVALID";
}

/**
 * แกะเลขอ้างอิงจาก payload แบบ TLV เพื่อโชว์ให้แอดมิน/เติมช่องเลขอ้างอิงตอนอนุมัติ
 * best effort ล้วน — คืน undefined ได้ (การกันซ้ำใช้ payload ทั้งก้อน ไม่พึ่งค่านี้)
 * ต้องแตกได้อย่างน้อย 2 ฟิลด์ และค่าที่เลือกต้องสั้นกว่า payload อย่างมีนัย ไม่งั้นถือว่าแกะไม่ได้
 */
export function extractQrReference(payload: string): string | undefined {
  if (!/^[0-9A-Za-z]+$/.test(payload)) return undefined;
  const values: string[] = [];
  let i = 0;
  while (i + 4 <= payload.length) {
    const length = Number(payload.slice(i + 2, i + 4));
    if (!Number.isFinite(length) || length <= 0) break;
    const value = payload.slice(i + 4, i + 4 + length);
    if (value.length !== length) break;
    values.push(value);
    i += 4 + length;
  }
  if (values.length < 2) return undefined;
  return values
    .filter((value) => value.length >= 10 && value.length <= payload.length * 0.75 && /^[0-9A-Za-z]+$/.test(value))
    .sort((a, b) => b.length - a.length)[0];
}
