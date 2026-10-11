import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { createTestPrisma, resetDatabase } from "./helpers";

const prisma = createTestPrisma();
const brokenDb = { $queryRaw: () => Promise.reject(new Error("db down")) } as unknown as PrismaClient;

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integration: rate limiter (real PostgreSQL)", () => {
  it("allows exactly `limit` requests even when they arrive at the same time", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => checkRateLimit("test:parallel", 5, 60, { db: prisma })),
    );

    expect(results.filter((result) => result.success)).toHaveLength(5);
    expect(results.filter((result) => !result.success)).toHaveLength(15);
  });

  it("starts a new window after the previous one expires", async () => {
    for (let attempt = 0; attempt < 2; attempt++) await checkRateLimit("test:window", 2, 1, { db: prisma });
    expect((await checkRateLimit("test:window", 2, 1, { db: prisma })).success).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const fresh = await checkRateLimit("test:window", 2, 1, { db: prisma });
    expect(fresh).toMatchObject({ success: true, remaining: 1 });
  });

  it("fails closed for money endpoints when the database is unavailable, and logs it", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await checkRateLimit("test:closed", 5, 60, { db: brokenDb, failClosed: true });
    expect(result.success).toBe(false);
    expect(errorLog).toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it("falls back to the in-memory limiter (fail open) by default, and logs it", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await checkRateLimit("test:open", 5, 60, { db: brokenDb })).success).toBe(true);
    expect(errorLog).toHaveBeenCalled();
    errorLog.mockRestore();
  });
});
