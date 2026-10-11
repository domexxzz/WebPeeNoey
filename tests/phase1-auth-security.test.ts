import { describe, it, expect, beforeEach } from "vitest";
import { hashPassword, verifyPassword, computeSlipHash, generateSecureToken, generateOrderNumber } from "@/lib/security";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { SITE_PLANS, getPlanBySlug, getPlanById, formatTHB } from "@/config/plans";

describe("Phase 1: Password & Cryptographic Security", () => {
  it("should securely hash and verify passwords using bcrypt", async () => {
    const rawPassword = "SuperSecurePassword123!";
    const hashed = await hashPassword(rawPassword);

    expect(hashed).toBeDefined();
    expect(hashed).not.toBe(rawPassword);
    expect(hashed.startsWith("$2")).toBe(true); // bcrypt prefix

    const isValid = await verifyPassword(rawPassword, hashed);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword("WrongPassword123!", hashed);
    expect(isInvalid).toBe(false);
  });

  it("should compute deterministic SHA-256 hash for bank slips to prevent duplication", () => {
    const slipBuffer1 = Buffer.from("fake-slip-image-binary-data-1");
    const slipBuffer2 = Buffer.from("fake-slip-image-binary-data-2");

    const hash1a = computeSlipHash(slipBuffer1);
    const hash1b = computeSlipHash(slipBuffer1);
    const hash2 = computeSlipHash(slipBuffer2);

    expect(hash1a).toHaveLength(64);
    expect(hash1a).toBe(hash1b); // Same file -> exact same hash
    expect(hash1a).not.toBe(hash2); // Different files -> different hashes
  });

  it("should generate cryptographically secure 64-char hex tokens for password reset", () => {
    const token1 = generateSecureToken();
    const token2 = generateSecureToken();

    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
  });

  it("should format order numbers with date prefix and unique uppercase suffix", () => {
    const orderNo = generateOrderNumber();
    expect(orderNo.startsWith("ORD-")).toBe(true);
    expect(orderNo).toMatch(/^ORD-\d{8}-[A-F0-9]{6}$/);
  });
});

describe("Phase 1: Rate Limiter Guard", () => {
  const testKey = "test:ratelimit:ip123";

  beforeEach(async () => {
    await resetRateLimit(testKey);
  });

  it("should allow requests under the limit and track remaining attempts", async () => {
    const res1 = await checkRateLimit(testKey, 3, 60);
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = await checkRateLimit(testKey, 3, 60);
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = await checkRateLimit(testKey, 3, 60);
    expect(res3.success).toBe(true);
    expect(res3.remaining).toBe(0);

    // 4th request must fail
    const res4 = await checkRateLimit(testKey, 3, 60);
    expect(res4.success).toBe(false);
    expect(res4.remaining).toBe(0);
  });

  it("should reset rate limit after reset is called", async () => {
    await checkRateLimit(testKey, 1, 60);
    const blocked = await checkRateLimit(testKey, 1, 60);
    expect(blocked.success).toBe(false);

    await resetRateLimit(testKey);
    const cleared = await checkRateLimit(testKey, 1, 60);
    expect(cleared.success).toBe(true);
  });
});

describe("Phase 1: Central Pricing & Plans Configuration", () => {
  it("should contain all 4 defined subscription plans in a single config file", () => {
    expect(SITE_PLANS).toHaveLength(4);
    const slugs = SITE_PLANS.map((p) => p.slug);
    expect(slugs).toEqual(["monthly", "quarterly", "biannual", "annual"]);
  });

  it("should enforce positive duration days and positive prices with discounts", () => {
    SITE_PLANS.forEach((plan) => {
      expect(plan.durationDays).toBeGreaterThan(0);
      expect(plan.price).toBeGreaterThan(0);
      expect(plan.originalPrice).toBeGreaterThan(plan.price);
      expect(plan.features.length).toBeGreaterThanOrEqual(3);
      expect(plan.lockPriceForLife).toBe(true);
    });
  });

  it("should retrieve plans correctly by slug and id", () => {
    const monthly = getPlanBySlug("monthly");
    expect(monthly).toBeDefined();
    expect(monthly?.price).toBe(990);
    expect(monthly?.durationDays).toBe(30);

    const annual = getPlanById("plan_12m");
    expect(annual).toBeDefined();
    expect(annual?.slug).toBe("annual");
    expect(annual?.price).toBe(7990);

    const invalid = getPlanBySlug("non-existent");
    expect(invalid).toBeUndefined();
  });

  it("should format THB currency strings accurately", () => {
    const formatted = formatTHB(990);
    expect(formatted).toContain("990");
    expect(formatted).toContain("฿");
  });
});
