import { createHash, timingSafeEqual } from "crypto";

/** ความลับที่ใช้ยืนยัน endpoint อัตโนมัติต้องยาวพอจะเดาไม่ได้ */
export const MIN_SECRET_LENGTH = 32;

/** เทียบสตริงแบบใช้เวลาคงที่ (hash ก่อนเพื่อให้ความยาวเท่ากันเสมอ) */
export function constantTimeEquals(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/** ตัวอักษรต่างกันอย่างน้อยเท่านี้ — กันค่าซ้ำ ๆ เช่น "aaaa…" */
const MIN_DISTINCT_CHARS = 12;
/** ค่าตัวอย่างที่อาจถูกคัดลอกไปใช้จริง (เช่นจาก .env.example) */
const PLACEHOLDER_PATTERN = /generate|example|change[-_]?me|placeholder|your[-_]?secret|secret[-_]?token/i;

/** ความลับที่ยาวพอ ไม่ใช่ค่าตัวอย่าง และมีความหลากหลายของตัวอักษรพอจะเดาไม่ได้ */
export function isStrongSecret(secret: string | undefined): secret is string {
  return Boolean(secret && secret.length >= MIN_SECRET_LENGTH && new Set(secret).size >= MIN_DISTINCT_CHARS && !PLACEHOLDER_PATTERN.test(secret));
}

const warned = new Set<string>();

function usableSecret(secret: string | undefined, name: string): string | null {
  if (isStrongSecret(secret)) return secret;
  // log ครั้งเดียวต่อโปรเซส ไม่ให้คำขอที่ไม่ผ่านการยืนยันท่วม log
  if (!warned.has(name)) {
    warned.add(name);
    console.error(`[auth] ${name} ไม่ได้ตั้งค่า สั้นกว่า ${MIN_SECRET_LENGTH} ตัว หรือเป็นค่าตัวอย่าง — ปฏิเสธทุกคำขอ`);
  }
  return null;
}

/** Cron (Vercel Cron / GitHub Actions) ส่ง `Authorization: Bearer <CRON_SECRET>` */
export function isAuthorizedCronRequest(authorization: string | null, secret: string | undefined): boolean {
  const expected = usableSecret(secret, "CRON_SECRET");
  return Boolean(expected && authorization && constantTimeEquals(authorization, `Bearer ${expected}`));
}

/** Telegram ส่ง header `X-Telegram-Bot-Api-Secret-Token` ตามค่าที่ลงทะเบียนตอน setWebhook */
export function isAuthorizedTelegramWebhook(headerValue: string | null, secret: string | undefined): boolean {
  const expected = usableSecret(secret, "TELEGRAM_WEBHOOK_SECRET");
  return Boolean(expected && headerValue && constantTimeEquals(headerValue, expected));
}
