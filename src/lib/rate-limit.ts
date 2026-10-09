import { prisma } from "./prisma";

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: Date;
}

// In-memory fallback map (ช่วยลดโหลด DB หรือทำงานตอนเทสต์)
const memoryStore = new Map<string, { count: number; expiresAt: Date }>();

/**
 * ตรวจสอบและนับ Rate Limit
 * @param key ตัวระบุ เช่น 'login:127.0.0.1' หรือ 'forgot:email@test.com'
 * @param limit จำนวนครั้งสูงสุดที่อนุญาตในช่วงเวลา
 * @param windowSeconds ระยะเวลาของหน้าต่าง (วินาที)
 */
export async function checkRateLimit(
  key: string,
  limit: number = 5,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);

  // 1. ตรวจสอบว่ามี DATABASE_URL หรือไม่ หากไม่มี ให้ใช้ Memory Store ทันที
  if (!process.env.DATABASE_URL) {
    return checkMemoryRateLimit(key, limit, windowSeconds);
  }

  // 2. ลองใช้ Database Rate Limiter
  try {
    const existing = await prisma.rateLimit.findUnique({
      where: { key },
    });

    if (!existing || existing.expiresAt <= now) {
      // สร้างใหม่หรือรีเซ็ต
      await prisma.rateLimit.upsert({
        where: { key },
        create: {
          key,
          count: 1,
          expiresAt: resetAt,
        },
        update: {
          count: 1,
          expiresAt: resetAt,
        },
      });

      return {
        success: true,
        remaining: limit - 1,
        resetAt,
      };
    }

    if (existing.count >= limit) {
      return {
        success: false,
        remaining: 0,
        resetAt: existing.expiresAt,
      };
    }

    const updated = await prisma.rateLimit.update({
      where: { key },
      data: {
        count: { increment: 1 },
      },
    });

    return {
      success: true,
      remaining: Math.max(0, limit - updated.count),
      resetAt: existing.expiresAt,
    };
  } catch (error) {
    // 3. หาก DB เกิด Error ให้ Fallback เป็น Memory Store ทันที
    return checkMemoryRateLimit(key, limit, windowSeconds);
  }
}

function checkMemoryRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);
  const mem = memoryStore.get(key);

  if (!mem || mem.expiresAt <= now) {
    memoryStore.set(key, { count: 1, expiresAt: resetAt });
    return {
      success: true,
      remaining: limit - 1,
      resetAt,
    };
  }

  if (mem.count >= limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: mem.expiresAt,
    };
  }

  mem.count += 1;
  return {
    success: true,
    remaining: Math.max(0, limit - mem.count),
    resetAt: mem.expiresAt,
  };
}

/**
 * ล้าง Rate Limit สำหรับคีย์นี้ (เช่น เมื่อ Login สำเร็จ ให้รีเซ็ตการนับ)
 */
export async function resetRateLimit(key: string): Promise<void> {
  memoryStore.delete(key);
  if (!process.env.DATABASE_URL) return;
  try {
    await prisma.rateLimit.delete({
      where: { key },
    });
  } catch {
    // ละเว้นหากไม่มีใน DB
  }
}
