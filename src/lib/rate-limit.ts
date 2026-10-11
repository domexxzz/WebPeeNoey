import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./prisma";

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: Date;
}

interface RateLimitOptions {
  /** endpoint เรื่องเงิน: ถ้าฐานข้อมูลใช้ไม่ได้ให้ปฏิเสธคำขอ แทนการยอมผ่านด้วย memory store */
  failClosed?: boolean;
  /** ใช้ในเทสต์เพื่อชี้ไปฐานข้อมูลทดสอบ */
  db?: PrismaClient;
}

// Memory store ใช้เมื่อไม่มี DATABASE_URL (unit test) หรือ DB ล่มแบบ fail-open — บน serverless แต่ละ instance แยกกัน
const memoryStore = new Map<string, { count: number; expiresAt: Date }>();

/**
 * ตรวจสอบและนับ Rate Limit แบบ atomic (INSERT ... ON CONFLICT) — คำขอที่มาพร้อมกันจะไม่หลุดเกิน limit
 * @param key ตัวระบุ เช่น 'login:127.0.0.1' หรือ 'submit-slip:<userId>'
 * @param limit จำนวนครั้งสูงสุดที่อนุญาตในช่วงเวลา
 * @param windowSeconds ระยะเวลาของหน้าต่าง (วินาที)
 */
export async function checkRateLimit(
  key: string,
  limit: number = 5,
  windowSeconds: number = 60,
  options: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const db = options.db ?? (process.env.DATABASE_URL ? defaultPrisma : null);
  if (!db) return checkMemoryRateLimit(key, limit, windowSeconds);

  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);
  try {
    const [row] = await db.$queryRaw<{ count: number; expiresAt: Date }[]>`
      INSERT INTO "RateLimit" ("id", "key", "count", "expiresAt")
      VALUES (gen_random_uuid()::text, ${key}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
        "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN ${resetAt} ELSE "RateLimit"."expiresAt" END
      RETURNING "count", "expiresAt"
    `;
    return { success: row.count <= limit, remaining: Math.max(0, limit - row.count), resetAt: row.expiresAt };
  } catch (error) {
    console.error("[rate-limit] ฐานข้อมูลใช้งานไม่ได้", { key, failClosed: Boolean(options.failClosed), error });
    if (options.failClosed) return { success: false, remaining: 0, resetAt };
    return checkMemoryRateLimit(key, limit, windowSeconds);
  }
}

function checkMemoryRateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);
  const mem = memoryStore.get(key);

  if (!mem || mem.expiresAt <= now) {
    memoryStore.set(key, { count: 1, expiresAt: resetAt });
    return { success: true, remaining: limit - 1, resetAt };
  }

  if (mem.count >= limit) {
    return { success: false, remaining: 0, resetAt: mem.expiresAt };
  }

  mem.count += 1;
  return { success: true, remaining: Math.max(0, limit - mem.count), resetAt: mem.expiresAt };
}

/**
 * ล้าง Rate Limit สำหรับคีย์นี้ (เช่น เมื่อ Login สำเร็จ ให้รีเซ็ตการนับ)
 */
export async function resetRateLimit(key: string, options: Pick<RateLimitOptions, "db"> = {}): Promise<void> {
  memoryStore.delete(key);
  const db = options.db ?? (process.env.DATABASE_URL ? defaultPrisma : null);
  if (!db) return;
  await db.rateLimit.deleteMany({ where: { key } });
}
