import { headers } from "next/headers";

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-fA-F:]{2,45}$/;

/** ตรวจรูปแบบ IP ก่อนบันทึกเป็นหลักฐาน (AuditLog / การยอมรับข้อกำหนด) */
export function isValidIp(value: string): boolean {
  return value.length <= 45 && (IPV4.test(value) || (value.includes(":") && IPV6.test(value)));
}

/**
 * IP ของผู้ใช้: ใช้ x-real-ip ที่ Vercel ตั้งเองก่อน (ผู้ใช้ปลอมไม่ได้) แล้วค่อย x-forwarded-for ตัวแรก
 * ค่าที่ไม่ใช่ IP จะถูกทิ้ง
 */
export function getClientIp(): string | undefined {
  const requestHeaders = headers();
  const candidates = [requestHeaders.get("x-real-ip"), requestHeaders.get("x-forwarded-for")?.split(",")[0]];
  return candidates.map((value) => value?.trim() ?? "").find((value) => value && isValidIp(value));
}
