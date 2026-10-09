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

/**
 * สุ่มรหัส Order Number เช่น ORD-20261010-A89F
 */
export function generateOrderNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `ORD-${dateStr}-${randomSuffix}`;
}
