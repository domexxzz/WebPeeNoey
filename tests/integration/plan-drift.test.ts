import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BROKER_IB_PLAN } from "@/config/broker-ib";
import { SITE_PLANS } from "@/config/plans";
import { seedDatabase } from "@/lib/db/seed";
import { findPlanDrift } from "@/lib/admin/plan-drift";
import { getSystemHealth } from "@/lib/admin/health";
import { JOB_NAMES, runJob } from "@/lib/jobs/job-run";
import { runWatchdog } from "@/lib/jobs/watchdog";
import { createTestPrisma, resetDatabase } from "./helpers";

const prisma = createTestPrisma();
const NOW = new Date("2026-10-29T08:00:00Z");
const okAlert = () => vi.fn(async (_text: string) => ({ ok: true as const }));

beforeEach(async () => {
  await resetDatabase(prisma);
  await seedDatabase(prisma, { adminEmail: "admin@example.com", adminPassword: "integration-test-password" });
  // งานตรวจวันหมดอายุเพิ่งสำเร็จ — Watchdog จะได้ไม่รายงานเรื่องอื่นปนมา
  await runJob(prisma, JOB_NAMES.CHECK_EXPIRY, async () => ({}), { alert: okAlert() });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integration: plan duration drift between code and database", () => {
  it("finds nothing when the seeded plans match the code", async () => {
    expect(await findPlanDrift(prisma)).toEqual([]);
  });

  it("reports the IB trial still at 30 days in the database while the code says 7 (the 29 Oct 2026 incident)", async () => {
    await prisma.plan.update({ where: { slug: BROKER_IB_PLAN.slug }, data: { durationDays: 30 } });

    expect(await findPlanDrift(prisma)).toEqual([{ slug: BROKER_IB_PLAN.slug, name: BROKER_IB_PLAN.name, codeDays: BROKER_IB_PLAN.durationDays, databaseDays: 30 }]);
  });

  it("reports a plan that exists in the code but is missing or inactive in the database", async () => {
    await prisma.plan.update({ where: { slug: SITE_PLANS[0].slug }, data: { isActive: false } });

    expect(await findPlanDrift(prisma)).toEqual([{ slug: SITE_PLANS[0].slug, name: SITE_PLANS[0].name, codeDays: SITE_PLANS[0].durationDays, databaseDays: null }]);
  });

  it("makes the hourly watchdog alert admins on Telegram, and say when it is fixed", async () => {
    await prisma.plan.update({ where: { slug: BROKER_IB_PLAN.slug }, data: { durationDays: 30 } });
    const alert = okAlert();

    const broken = await runWatchdog(prisma, { siteUrl: "https://example.test", now: NOW, alert, webhookCheck: null });

    expect(broken.ok && broken.summary.problemKeys).toEqual(["plan-duration-drift"]);
    expect(alert).toHaveBeenCalledWith(expect.stringContaining(`${BROKER_IB_PLAN.slug}: ฐานข้อมูล 30 วัน แต่โค้ด ${BROKER_IB_PLAN.durationDays} วัน`));

    await prisma.plan.update({ where: { slug: BROKER_IB_PLAN.slug }, data: { durationDays: BROKER_IB_PLAN.durationDays } });
    const fixed = await runWatchdog(prisma, { siteUrl: "https://example.test", now: new Date(NOW.getTime() + 3_600_000), alert, webhookCheck: null });

    expect(fixed.ok && fixed.summary).toMatchObject({ healthy: true, recovered: true });
    expect(alert).toHaveBeenLastCalledWith(expect.stringContaining("กลับมาทำงานปกติ"));
  });

  it("shows the drift on the admin status page", async () => {
    await prisma.plan.update({ where: { slug: BROKER_IB_PLAN.slug }, data: { durationDays: 30 } });

    const health = await getSystemHealth(prisma, { env: {}, now: NOW });

    expect(health.planDrift).toEqual([expect.objectContaining({ slug: BROKER_IB_PLAN.slug, codeDays: BROKER_IB_PLAN.durationDays, databaseDays: 30 })]);
  });
});
