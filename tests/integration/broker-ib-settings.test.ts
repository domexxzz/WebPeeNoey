import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "crypto";
import type { OrderStatus } from "@prisma/client";
import { SITE_PLANS } from "@/config/plans";
import { BROKER_IB_PLAN } from "@/config/broker-ib";
import { seedDatabase, SYSTEM_SETTING_ID } from "@/lib/db/seed";
import { createOrder, quoteForUser, submitSlip } from "@/lib/orders/checkout";
import { approveOrder, refundOrder } from "@/lib/admin/order-review";
import { updatePaymentSettings } from "@/lib/admin/settings";
import { listAdminOrders } from "@/lib/admin/orders-query";
import { getRevenueSummary } from "@/lib/admin/dashboard";
import { getBrokerIbAvailability } from "@/lib/broker-ib/availability";
import { updateBrokerIbSettings } from "@/lib/broker-ib/settings";
import { createTestPrisma, resetDatabase } from "./helpers";

const prisma = createTestPrisma();
const T0 = new Date("2026-10-15T03:00:00Z");
const XM_LINK = "https://clicks.pipaffiliates.com/c?c=111&l=en";
const EXNESS_LINK = "https://one.exnesstrack.org/a/abc123";

let adminId: string;
const actor = () => ({ id: adminId, ipAddress: "203.0.113.7" });

async function member() {
  return prisma.user.create({ data: { email: `m-${randomBytes(4).toString("hex")}@example.com`, role: "USER", passwordHash: "x" } });
}

/** ออเดอร์ IB แบบตรง ๆ (บริการยื่นคำขออยู่ Phase 2) — ใช้ทดสอบว่าเส้นทางเงินไม่แตะออเดอร์ชนิดนี้ */
async function ibOrder(userId: string, status: OrderStatus) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { slug: BROKER_IB_PLAN.slug } });
  return prisma.order.create({
    data: {
      orderNumber: `IB-TEST-${randomBytes(3).toString("hex").toUpperCase()}`,
      userId,
      planId: plan.id,
      amount: 0,
      basePrice: 0,
      status,
      kind: "BROKER_IB",
      expiresAt: T0,
    },
  });
}

const save = (overrides: Partial<Parameters<typeof updateBrokerIbSettings>[1]> = {}) =>
  updateBrokerIbSettings(prisma, { actor: actor(), ibClaimsEnabled: true, xmLink: XM_LINK, exnessLink: EXNESS_LINK, xmMinDepositThb: "1000", exnessMinDepositThb: "1500", usdThbRate: "33.5", ...overrides });

beforeEach(async () => {
  await resetDatabase(prisma);
  await seedDatabase(prisma, { adminEmail: "admin@example.com", adminPassword: "integration-test-password" });
  adminId = (await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integration: broker IB settings", () => {
  it("saves normalized links, the minimum deposit and the switch, with a before/after audit entry", async () => {
    const result = await save({ xmLink: `  ${XM_LINK} `, xmMinDepositThb: "1,500.50" });

    expect(result).toMatchObject({ ok: true, warnings: [], changed: true, before: { ibClaimsEnabled: false, ibXmLink: "" } });
    const setting = await prisma.systemSetting.findUniqueOrThrow({ where: { id: SYSTEM_SETTING_ID } });
    expect(setting).toMatchObject({ ibClaimsEnabled: true, ibXmLink: XM_LINK, ibExnessLink: EXNESS_LINK });
    expect(setting.ibMinDepositXmThb?.toNumber()).toBe(1500.5);
    expect(setting.ibUsdThbRate?.toNumber()).toBe(33.5);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "IB_SETTINGS_UPDATE" } });
    expect(audit).toMatchObject({ actorId: adminId, targetType: "System", targetId: SYSTEM_SETTING_ID, ipAddress: "203.0.113.7" });
    expect(audit.details).toMatchObject({
      before: { ibClaimsEnabled: false, ibXmLink: "", ibExnessLink: "", ibMinDepositXmThb: null, ibMinDepositExnessThb: null, ibUsdThbRate: null },
      after: { ibClaimsEnabled: true, ibXmLink: XM_LINK, ibExnessLink: EXNESS_LINK, ibMinDepositXmThb: 1500.5, ibMinDepositExnessThb: 1500, ibUsdThbRate: 33.5 },
    });
    expect(await getBrokerIbAvailability(prisma)).toMatchObject({ open: true, usdThbRate: 33.5 });
  });

  it("warns (but saves) when a link is not on a domain known for that broker", async () => {
    const result = await save({ xmLink: "https://partners.example.net/ref/123" });

    expect(result.ok).toBe(true);
    expect(result.ok && result.warnings).toEqual([expect.stringContaining("partners.example.net")]);
    expect((await prisma.systemSetting.findUniqueOrThrow({ where: { id: SYSTEM_SETTING_ID } })).ibXmLink).toBe("https://partners.example.net/ref/123");
  });

  it("refuses to switch on without a minimum deposit or a link, and refuses bad values — writing nothing", async () => {
    expect(await save({ xmMinDepositThb: "", exnessMinDepositThb: "" })).toEqual({ ok: false, code: "IB_NOT_CONFIGURED" });
    expect(await save({ xmLink: "", exnessLink: "" })).toEqual({ ok: false, code: "IB_NOT_CONFIGURED" });
    expect(await save({ xmLink: "http://xm.com/ref" })).toEqual({ ok: false, code: "INVALID_IB_LINK" });
    expect(await save({ exnessLink: "javascript:alert(1)" })).toEqual({ ok: false, code: "INVALID_IB_LINK" });
    expect(await save({ xmMinDepositThb: "0" })).toEqual({ ok: false, code: "INVALID_MIN_DEPOSIT" });

    expect(await prisma.auditLog.count({ where: { action: "IB_SETTINGS_UPDATE" } })).toBe(0);
    expect((await prisma.systemSetting.findUniqueOrThrow({ where: { id: SYSTEM_SETTING_ID } })).ibClaimsEnabled).toBe(false);
  });

  it("can be saved switched off with partial values (preparing before opening)", async () => {
    expect(await save({ ibClaimsEnabled: false, exnessLink: "", xmMinDepositThb: "", exnessMinDepositThb: "" })).toMatchObject({ ok: true, warnings: [] });
    expect(await getBrokerIbAvailability(prisma)).toEqual({ open: false, reason: "DISABLED" });
  });

  it("reports no change when the same (normalized) values are saved again", async () => {
    await save();
    expect(await save({ xmLink: "  https://clicks.pipaffiliates.com/c?c=111&l=en  ", xmMinDepositThb: "1000.00" })).toMatchObject({ ok: true, changed: false });
  });

  it("keeps a correct before/after chain when two admins save at the same time (row lock)", async () => {
    await Promise.all([save({ xmMinDepositThb: "1000" }), save({ xmMinDepositThb: "2000" })]);

    const audits = await prisma.auditLog.findMany({ where: { action: "IB_SETTINGS_UPDATE" }, orderBy: { createdAt: "asc" } });
    expect(audits).toHaveLength(2);
    const [first, second] = audits.map((audit) => audit.details as { before: { ibMinDepositXmThb: number | null }; after: { ibMinDepositXmThb: number } });
    expect(second.before.ibMinDepositXmThb).toBe(first.after.ibMinDepositXmThb);
  });

  it("does not touch PromptPay settings, and PromptPay settings do not touch IB settings", async () => {
    await prisma.systemSetting.update({ where: { id: SYSTEM_SETTING_ID }, data: { promptpayNumber: "0812345678", promptpayAccountName: "บัญชีทดสอบ" } });
    await save();
    await updatePaymentSettings(prisma, { actor: actor(), paymentsEnabled: true, maintenanceMode: false, promptpayNumber: "0812345678", promptpayAccountName: "บัญชีทดสอบ" });

    const setting = await prisma.systemSetting.findUniqueOrThrow({ where: { id: SYSTEM_SETTING_ID } });
    expect(setting).toMatchObject({ paymentsEnabled: true, promptpayNumber: "0812345678", ibClaimsEnabled: true, ibXmLink: XM_LINK });
  });

  it("reports closed during maintenance mode", async () => {
    await save();
    await prisma.systemSetting.update({ where: { id: SYSTEM_SETTING_ID }, data: { maintenanceMode: true } });
    expect(await getBrokerIbAvailability(prisma)).toEqual({ open: false, reason: "MAINTENANCE" });
  });
});

describe("Integration: paid money paths never touch broker IB orders", () => {
  beforeEach(async () => {
    await prisma.systemSetting.update({
      where: { id: SYSTEM_SETTING_ID },
      data: { paymentsEnabled: true, promptpayNumber: "0812345678", promptpayAccountName: "บัญชีทดสอบ" },
    });
  });

  it("checkout cannot quote or sell the free IB plan", async () => {
    const user = await member();
    expect(await quoteForUser(prisma, { userId: user.id, planSlug: BROKER_IB_PLAN.slug })).toBeNull();
    expect(await createOrder(prisma, { userId: user.id, planSlug: BROKER_IB_PLAN.slug, now: T0 })).toEqual({ ok: false, code: "PLAN_NOT_FOUND" });
    expect(await prisma.order.count()).toBe(0);
  });

  it("an open IB claim does not use up the member's paid open-order slots", async () => {
    const user = await member();
    await ibOrder(user.id, "CLAIM_SUBMITTED");
    expect(await createOrder(prisma, { userId: user.id, planSlug: SITE_PLANS[0].slug, now: T0 })).toMatchObject({ ok: true });
  });

  it("a slip can never be attached to an IB order (even a rejected one)", async () => {
    const user = await member();
    for (const status of ["CLAIM_SUBMITTED", "REJECTED"] as const) {
      const order = await ibOrder(user.id, status);
      const slip = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from(randomBytes(32))]);
      expect(await submitSlip(prisma, { userId: user.id, orderId: order.id, bytes: slip, now: T0 })).toEqual({ ok: false, code: "ORDER_NOT_FOUND" });
    }
    expect(await prisma.slipUpload.count()).toBe(0);
  });

  it("slip approval cannot act on an IB claim, and an approved IB grant cannot be refunded", async () => {
    const user = await member();
    const claim = await ibOrder(user.id, "CLAIM_SUBMITTED");
    expect(await approveOrder(prisma, { orderId: claim.id, actor: actor(), referenceNo: "REF12345", now: T0 })).toEqual({ ok: false, code: "NOT_PENDING_REVIEW" });

    const approved = await ibOrder(user.id, "APPROVED");
    expect(await refundOrder(prisma, { orderId: approved.id, actor: actor(), amount: 1, reason: "ทดสอบ", now: T0 })).toEqual({ ok: false, code: "NOT_REFUNDABLE" });
    expect(await prisma.refund.count()).toBe(0);
  });

  it("admin order lists and revenue ignore IB orders", async () => {
    const user = await member();
    await ibOrder(user.id, "APPROVED");
    await ibOrder(user.id, "CLAIM_SUBMITTED");

    const all = await listAdminOrders(prisma, { tab: "all", now: T0 });
    expect(all.total).toBe(0);
    expect(all.counts.all).toBe(0);
    expect(all.counts.approved).toBe(0);
    expect(await getRevenueSummary(prisma)).toMatchObject({ gross: 0, paidOrders: 0 });
  });
});
