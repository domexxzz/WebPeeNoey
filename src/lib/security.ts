import crypto from "crypto";
import bcrypt from "bcryptjs";

const BCRYPT_SALT_ROUNDS = 12;

/**
 * แฮชรหัสผ่านด้วย bcrypt (Salt rounds 12)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * ตรวจสอบรหัสผ่านกับค่าแฮชที่บันทึกไว้
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * คำนวณ SHA-256 Hash ของไฟล์สลิปเพื่อป้องกันการอัปโหลดสลิปซ้ำเด็ดขาด
 */
export function computeSlipHash(buffer: Buffer | Uint8Array): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * สร้าง Random Token ความปลอดภัยสูงสำหรับ Reset Password (32 bytes hex)
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** hash ของโทเคนที่ส่งทางอีเมล — เก็บแค่ hash ในฐานข้อมูล (ข้อมูลหลุดก็ใช้รีเซ็ตรหัสผ่านไม่ได้) */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** ORD = ออเดอร์ชำระเงิน, IB = คำขอสิทธิ์ผ่านโบรกเกอร์ */
export type OrderNumberPrefix = "ORD" | "IB";

/**
 * สุ่มรหัส Order Number เช่น ORD-20261010-A89F3C (วันที่ตามเวลาไทย + สุ่ม 6 หลัก)
 * ผู้เรียกต้องลองใหม่เมื่อชน unique constraint (โอกาสต่ำมาก)
 */
export function generateOrderNumber(now: Date = new Date(), prefix: OrderNumberPrefix = "ORD"): string {
  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now)
    .replace(/-/g, "");
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${dateStr}-${randomSuffix}`;
}
