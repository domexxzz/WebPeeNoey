import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { SITE_PLANS } from "@/config/plans";
import { verifyPassword } from "@/lib/security";
import { SYSTEM_SETTING_ID, seedDatabase } from "@/lib/db/seed";
import { assertSafeTestDatabaseUrl } from "./global-setup";
import { createTestPrisma, resetDatabase } from "./helpers";

const prisma = createTestPrisma();
const OPTIONS = { adminEmail: "Admin.Test@Example.com", adminPassword: "integration-test-password-123" };

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integration: database seed (real PostgreSQL)", () => {
  it("creates every plan from config with exact prices and order", async () => {
    await seedDatabase(prisma, OPTIONS);

    const plans = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
    expect(plans.map((plan) => plan.slug)).toEqual(SITE_PLANS.map((plan) => plan.slug));
    plans.forEach((plan, index) => {
      expect(plan.price.toNumber()).toBe(SITE_PLANS[index].price);
      expect(plan.durationDays).toBe(SITE_PLANS[index].durationDays);
      expect(plan.promoEnrolledCount).toBe(0);
    });
  });

  it("creates system settings with payments disabled and no PromptPay account", async () => {
    await seedDatabase(prisma, OPTIONS);

    const setting = await prisma.systemSetting.findUniqueOrThrow({ where: { id: SYSTEM_SETTING_ID } });
    expect(setting.paymentsEnabled).toBe(false);
    expect(setting.promptpayNumber).toBe("");
    expect(setting.promptpayAccountName).toBe("");
  });

  it("creates one admin with a bcrypt-hashed password and a normalized email", async () => {
    const result = await seedDatabase(prisma, OPTIONS);

    expect(result.adminCreated).toBe(true);
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
    expect(admins).toHaveLength(1);
    expect(admins[0].email).toBe("admin.test@example.com");
    expect(admins[0].passwordHash).not.toBe(OPTIONS.adminPassword);
    expect(await verifyPassword(OPTIONS.adminPassword, admins[0].passwordHash!)).toBe(true);
  });

  it("is idempotent and never overwrites admin passwords, admin settings or promo counters", async () => {
    await seedDatabase(prisma, OPTIONS);
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin.test@example.com" } });
    await prisma.systemSetting.update({ where: { id: SYSTEM_SETTING_ID }, data: { promptpayNumber: "0999999999" } });
    await prisma.plan.update({ where: { slug: SITE_PLANS[0].slug }, data: { promoEnrolledCount: 7 } });

    const second = await seedDatabase(prisma, { ...OPTIONS, adminPassword: "a-different-password-456" });

    expect(second.adminCreated).toBe(false);
    expect(await prisma.plan.count()).toBe(SITE_PLANS.length);
    expect(await prisma.user.count()).toBe(1);
    const adminAfter = await prisma.user.findUniqueOrThrow({ where: { email: "admin.test@example.com" } });
    expect(adminAfter.passwordHash).toBe(admin.passwordHash);
    const setting = await prisma.systemSetting.findUniqueOrThrow({ where: { id: SYSTEM_SETTING_ID } });
    expect(setting.promptpayNumber).toBe("0999999999");
    const plan = await prisma.plan.findUniqueOrThrow({ where: { slug: SITE_PLANS[0].slug } });
    expect(plan.promoEnrolledCount).toBe(7);
  });

  it("promotes an existing member to admin and replaces their password with the seed password", async () => {
    // กันกรณีคนนอกสมัครด้วย ADMIN_EMAIL ดักไว้ก่อน (ยังไม่มีการยืนยันอีเมล) แล้วได้สิทธิ์แอดมินพร้อมรหัสผ่านของตัวเอง
    const member = await prisma.user.create({
      data: { email: "admin.test@example.com", role: "USER", passwordHash: "attacker-chosen-hash" },
    });

    const result = await seedDatabase(prisma, OPTIONS);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(result.adminCreated).toBe(false);
    expect(updated.role).toBe("ADMIN");
    expect(updated.passwordHash).not.toBe("attacker-chosen-hash");
    expect(await verifyPassword(OPTIONS.adminPassword, updated.passwordHash!)).toBe(true);
  });

  it("rejects weak seed passwords and invalid emails before touching the database", async () => {
    await expect(seedDatabase(prisma, { ...OPTIONS, adminPassword: "short" })).rejects.toThrow(/SEED_ADMIN_PASSWORD/);
    await expect(seedDatabase(prisma, { ...OPTIONS, adminEmail: "not-an-email" })).rejects.toThrow(/ADMIN_EMAIL/);
    expect(await prisma.plan.count()).toBe(0);
  });
});

describe("Integration: test database guard", () => {
  it("refuses remote hosts and databases not ending in _test", () => {
    expect(() => assertSafeTestDatabaseUrl("postgresql://u:p@db.example.com:5432/app_test")).toThrow(/localhost/);
    expect(() => assertSafeTestDatabaseUrl("postgresql://u:p@localhost:5432/app")).toThrow(/_test/);
    expect(() => assertSafeTestDatabaseUrl(undefined)).toThrow(/DATABASE_URL_TEST/);
    expect(assertSafeTestDatabaseUrl("postgresql://u:p@localhost:5432/app_test").hostname).toBe("localhost");
  });
});
