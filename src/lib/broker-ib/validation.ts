import type { Broker } from "@prisma/client";
import { BROKERS, BROKER_IB_RULES } from "@/config/broker-ib";

/** ตัวช่วยตรวจข้อมูลสิทธิ์ผ่าน IB — ฟังก์ชันล้วน ทดสอบได้ใน Node */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * MT4/MT5 Login → ตัวเลขล้วน (ตัดช่องว่าง/ขีด และเลข 0 นำหน้า) หรือ null ถ้าไม่ถูกต้อง — ตัวเลขเต็มความกว้างไม่ผ่าน
 * ตัด 0 นำหน้าเพื่อให้ "0123456" กับ "123456" เป็นบัญชีเดียวกัน (กันผูกบัญชีเดียวซ้ำ)
 */
export function normalizeAccountNumber(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "").replace(/^0+(?=\d)/, "");
  return BROKER_IB_RULES.accountNumberPattern.test(digits) ? digits : null;
}

export function normalizeBrokerEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return email.length <= EMAIL_MAX && EMAIL_PATTERN.test(email) ? email : null;
}

/**
 * ลิงก์พาร์ทเนอร์: ว่าง = ล้างค่า, นอกนั้นต้องเป็น https:// ไม่มีชื่อผู้ใช้/รหัสผ่านในลิงก์ และยาวไม่เกินกำหนด
 * ไม่จำกัดโดเมน (ลิงก์พาร์ทเนอร์จริงมักเป็นโดเมนติดตามของบริษัทอื่น) — ใช้ isKnownBrokerHost เตือนแทน
 */
export function normalizeBrokerLink(raw: string): { ok: true; url: string } | { ok: false } {
  const value = raw.trim();
  if (!value) return { ok: true, url: "" };
  if (value.length > BROKER_IB_RULES.linkMaxLength) return { ok: false };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false };
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname) return { ok: false };
  return { ok: true, url: url.toString() };
}

/** โดเมนของลิงก์เป็นของโบรกเกอร์นั้น (หรือโดเมนติดตามลิงก์พาร์ทเนอร์ที่รู้จัก) หรือไม่ */
export function isKnownBrokerHost(broker: Broker, link: string): boolean {
  let host: string;
  try {
    host = new URL(link).hostname.toLowerCase();
  } catch {
    return false;
  }
  return BROKERS[broker].knownHosts.some((known) => host === known || host.endsWith(`.${known}`));
}

/** ยอดฝากขั้นต่ำ (USD): ว่าง = ยังไม่ตั้ง, ทศนิยมไม่เกิน 2 ตำแหน่ง, อยู่ในช่วงที่กำหนด */
export function parseMinDepositUsd(raw: string): { ok: true; value: number | null } | { ok: false } {
  const value = raw.trim();
  if (!value) return { ok: true, value: null };
  if (!MONEY_PATTERN.test(value)) return { ok: false };
  const amount = Number(value);
  const { min, max } = BROKER_IB_RULES.minDepositUsd;
  return amount >= min && amount <= max ? { ok: true, value: amount } : { ok: false };
}

/** เลขบัญชีเทรดแบบปิดบัง (แจ้งเตือน Telegram / หน้าสมาชิก) */
export function maskAccountNumber(accountNumber: string): string {
  return accountNumber.length <= 4 ? "****" : `****${accountNumber.slice(-4)}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return domain ? `${local.charAt(0)}***@${domain}` : "***";
}
