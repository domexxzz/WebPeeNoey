import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "crypto";
import { SITE_PLANS } from "@/config/plans";
import { seedDatabase, SYSTEM_SETTING_ID } from "@/lib/db/seed";
import { createOrder, submitSlip } from "@/lib/orders/checkout";
import { approveOrder, refundOrder } from "@/lib/admin/order-review";
import { getAdminActor } from "@/lib/admin/guard";
import { getMembershipSummary } from "@/lib/admin/membership";
import { getMemberDetail, revokeMemberAccess, searchMembers, setProvisioning } from "@/lib/admin/members";
import { updatePaymentSettings } from "@/lib/admin/settings";
import { getAdminOrderDetail, listAdminOrders } from "@/lib/admin/orders-query";
import { listAuditLogs } from "@/lib/admin/audit";
import { getSystemHealth } from "@/lib/admin/health";
import { getDashboardStats } from "@/lib/admin/dashboard";
import { createTestPrisma, resetDatabase } from "./helpers";

const prisma = createTestPrisma();
const T0 = new Date("2026-10-11T03:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60 * 1000);
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
let adminId: string;
const actor = () => ({ id: adminId, ipAddress: "203.0.113.9" });

async function member(email = `m-${randomBytes(4).toString("hex")}@example.com`, extra: Record<string, string> = {}) {
  return prisma.user.create({ data: { email, role: "USER", passwordHash: "x", ...extra } });
}

async function activeMember(email?: string) {
  const user = await member(email);
  const created = await createOrder(prisma, { userId: user.id, planSlug: SITE_PLANS[0].slug, now: T0 });
  if (!created.ok) throw new Error(created.code);
  const slip = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from(randomBytes(32))]);
  await submitSlip(prisma, { userId: user.id, orderId: created.orderId, bytes: slip, now: at(1) });
  await approveOrder(prisma, { orderId: created.orderId, actor: actor(), referenceNo: `REF${randomBytes(4).toString("hex")}`, now: at(2) });
  return { user, orderId: created.orderId };
}

beforeEach(async () => {
  await resetDatabase(prisma);
  await seedDatabase(prisma, { adminEmail: "admin@example.com", adminPassword: "integration-test-password" });
  adminId = (await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })).id;
  await prisma.systemSetting.update({
    where: { id: SYSTEM_SETTING_ID },
    data: { paymentsEnabled: true, promptpayNumber: "0812345678", promptpayAccountName: "บัญชีทดสอบ" },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integration: admin guard", () => {
  it("accepts only users who are admins in the database", async () => {
    const user = await member();
    expect(await getAdminActor(prisma, adminId)).toMatchObject({ id: adminId, email: "admin@example.com" });
    expect(await getAdminActor(prisma, user.id)).toBeNull();
    expect(await getAdminActor(prisma, "missing")).toBeNull();
    expect(await getAdminActor(prisma, undefined)).toBeNull();
  });
});

describe("Integration: payment settings", () => {
  it("normalizes the PromptPay number, saves settings and audits the before/after values", async () => {
    const result = await updatePaymentSettings(prisma, {
      actor: actor(),
      paymentsEnabled: true,
      maintenanceMode: false,
      promptpayNumber: "089-999-9999",
      promptpayAccountName: "  ร้านจริง  ",
    });

    expect(result).toEqual({ ok: true });
    expect(await prisma.systemSetting.findUniqueOrThrow({ where: { id: SYSTEM_SETTING_ID } })).toMatchObject({
      promptpayNumber: "0899999999",
      promptpayAccountName: "ร้านจริง",
    });
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "SETTINGS_UPDATE" } });
    expect(audit.details).toMatchObject({ before: { promptpayNumber: "0812345678" }, after: { promptpayNumber: "0899999999" } });
  });

  it("refuses to open payments without a valid PromptPay number and account name", async () => {
    const base = { actor: actor(), paymentsEnabled: true, maintenanceMode: false };
    expect(await updatePaymentSettings(prisma, { ...base, promptpayNumber: "123", promptpayAccountName: "x" })).toEqual({ ok: false, code: "INVALID_PROMPTPAY" });
    expect(await updatePaymentSettings(prisma, { ...base, promptpayNumber: "0899999999", promptpayAccountName: " " })).toEqual({ ok: false, code: "ACCOUNT_NAME_REQUIRED" });
    expect((await prisma.systemSetting.findUniqueOrThrow({ where: { id: SYSTEM_SETTING_ID } })).promptpayNumber).toBe("0812345678");
  });

  it("allows closing payments and clearing the account", async () => {
    const result = await updatePaymentSettings(prisma, { actor: actor(), paymentsEnabled: false, maintenanceMode: true, promptpayNumber: "", promptpayAccountName: "" });
    expect(result).toEqual({ ok: true });
    expect(await prisma.systemSetting.findUniqueOrThrow({ where: { id: SYSTEM_SETTING_ID } })).toMatchObject({ paymentsEnabled: false, maintenanceMode: true });
  });
});

describe("Integration: members", () => {
  it("finds members by email, name or TradingView username with their membership status", async () => {
    await activeMember("alice@example.com");
    await member("bob@example.com", { tradingViewUsername: "bob_tv" });

    const byEmail = await searchMembers(prisma, { q: "ALICE", now: at(3) });
    expect(byEmail.items.map((item) => item.email)).toEqual(["alice@example.com"]);
    expect(byEmail.items[0].membership.active).toBe(true);
    expect((await searchMembers(prisma, { q: "bob_tv", now: at(3) })).items.map((item) => item.email)).toEqual(["bob@example.com"]);
  });

  it("revokes every active period immediately and audits it", async () => {
    const { user } = await activeMember();

    const result = await revokeMemberAccess(prisma, { userId: user.id, actor: actor(), reason: "แชร์บัญชีให้ผู้อื่น", now: at(5) });

    expect(result).toEqual({ ok: true, revoked: 1 });
    expect((await getMembershipSummary(prisma, { userId: user.id, now: at(6) })).active).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: "MEMBER_REVOKE", targetId: user.id } })).toBe(1);
    expect(await revokeMemberAccess(prisma, { userId: user.id, actor: actor(), reason: "", now: at(7) })).toEqual({ ok: false, code: "REASON_REQUIRED" });
  });

  it("records manual provisioning per channel with an audit trail", async () => {
    const { orderId } = await activeMember();
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { orderId } });

    await setProvisioning(prisma, { subscriptionId: subscription.id, channel: "tradingView", granted: true, actor: actor() });

    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).tradingViewGranted).toBe(true);
    expect(await prisma.auditLog.findFirstOrThrow({ where: { action: "PROVISIONING_UPDATE" } })).toMatchObject({ targetId: subscription.id });
  });

  it("returns member detail with orders and subscription periods", async () => {
    const { user } = await activeMember();
    const detail = await getMemberDetail(prisma, { userId: user.id, now: at(3) });
    expect(detail?.orders).toHaveLength(1);
    expect(detail?.subscriptions).toHaveLength(1);
    expect(detail?.membership.active).toBe(true);
    expect(await getMemberDetail(prisma, { userId: "missing", now: at(3) })).toBeNull();
  });
});

describe("Integration: admin order queries", () => {
  it("lists orders per tab with counts and search, without loading slip bytes", async () => {
    await activeMember("approved@example.com");
    const waiting = await member("waiting@example.com");
    const created = await createOrder(prisma, { userId: waiting.id, planSlug: SITE_PLANS[1].slug, now: T0 });
    await submitSlip(prisma, { userId: waiting.id, orderId: created.ok ? created.orderId : "", bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]), now: at(1) });

    const review = await listAdminOrders(prisma, { tab: "review" });
    expect(review.items.map((item) => item.email)).toEqual(["waiting@example.com"]);
    expect(review.counts).toMatchObject({ review: 1, approved: 1 });
    expect((await listAdminOrders(prisma, { tab: "all", q: "approved@" })).items).toHaveLength(1);
    expect(JSON.stringify(review.items)).not.toContain('"data"');
  });

  it("expires stale unpaid orders before counting tabs so the pending queue is accurate", async () => {
    const user = await member();
    await createOrder(prisma, { userId: user.id, planSlug: SITE_PLANS[0].slug, now: T0 });

    const later = await listAdminOrders(prisma, { tab: "pending", now: at(24 * 60) });

    expect(later.counts.pending).toBe(0);
    expect(later.counts.expired).toBe(1);
  });

  it("returns order detail with slips metadata and the audit trail", async () => {
    const { orderId } = await activeMember();
    const detail = await getAdminOrderDetail(prisma, orderId);
    expect(detail?.slips).toHaveLength(1);
    expect(detail?.slips[0]).not.toHaveProperty("data");
    expect(detail?.auditLogs.map((log) => log.action)).toContain("ORDER_APPROVE");
    expect(await getAdminOrderDetail(prisma, "missing")).toBeNull();
  });
});

describe("Integration: audit log listing", () => {
  it("filters by action and paginates newest first", async () => {
    await activeMember();
    await updatePaymentSettings(prisma, { actor: actor(), paymentsEnabled: false, maintenanceMode: false, promptpayNumber: "", promptpayAccountName: "" });

    const all = await listAuditLogs(prisma, {});
    expect(all.items[0].action).toBe("SETTINGS_UPDATE");
    expect((await listAuditLogs(prisma, { action: "ORDER_APPROVE" })).items.every((item) => item.action === "ORDER_APPROVE")).toBe(true);
    expect(all.items[0].actorEmail).toBe("admin@example.com");
  });
});

describe("Integration: audit log immutability", () => {
  it("blocks updates and deletes of audit logs at the database level", async () => {
    await activeMember();
    const log = await prisma.auditLog.findFirstOrThrow();

    await expect(prisma.auditLog.update({ where: { id: log.id }, data: { action: "TAMPERED" } })).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.delete({ where: { id: log.id } })).rejects.toThrow(/append-only/);
  });
});

describe("Integration: de-provisioning queue", () => {
  it("counts revoked subscriptions that still have channel access marked as granted", async () => {
    const { user, orderId } = await activeMember();
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { orderId } });
    await setProvisioning(prisma, { subscriptionId: subscription.id, channel: "discord", granted: true, actor: actor() });
    await revokeMemberAccess(prisma, { userId: user.id, actor: actor(), reason: "ละเมิดข้อกำหนด", now: at(5) });

    const health = await getSystemHealth(prisma, { env: {}, now: at(6) });

    expect(health.queues.pendingDeprovision).toBe(1);
  });
});

describe("Integration: dashboard stats", () => {
  async function approvedRenewal(userId: string, minute: number) {
    const created = await createOrder(prisma, { userId, planSlug: SITE_PLANS[0].slug, now: at(minute) });
    if (!created.ok) throw new Error(created.code);
    const slip = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from(randomBytes(32))]);
    await submitSlip(prisma, { userId, orderId: created.orderId, bytes: slip, now: at(minute + 1) });
    await approveOrder(prisma, { orderId: created.orderId, actor: actor(), referenceNo: `REF${randomBytes(4).toString("hex")}`, now: at(minute + 2) });
  }

  it("counts members per person, skips renewed members when flagging expiry and nets refunds out of revenue", async () => {
    const expiring = await activeMember();
    const renewed = await activeMember();
    await approvedRenewal(renewed.user.id, 3);
    const refunded = await activeMember();
    await refundOrder(prisma, { orderId: refunded.orderId, actor: actor(), amount: 100, reason: "ลูกค้าขอคืนภายใน 7 วัน", transferReference: "RF-9", now: at(10) });
    const waiting = await member();
    const open = await createOrder(prisma, { userId: waiting.id, planSlug: SITE_PLANS[0].slug, now: at(11) });
    if (!open.ok) throw new Error(open.code);
    await submitSlip(prisma, { userId: waiting.id, orderId: open.orderId, bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from(randomBytes(32))]), now: at(12) });

    const paid = await prisma.order.findMany({ where: { status: { in: ["APPROVED", "REFUNDED"] } }, select: { amount: true } });
    const grossCents = paid.reduce((sum, order) => sum + Math.round(order.amount.toNumber() * 100), 0);
    const firstEnd = (await prisma.subscription.findUniqueOrThrow({ where: { orderId: expiring.orderId } })).currentPeriodEnd;

    // 1 วันก่อนหมด: ทั้งสองคนยังใช้งานได้ แต่คนที่ต่ออายุไว้แล้วไม่ถือว่าใกล้หมด
    const before = await getDashboardStats(prisma, { now: new Date(firstEnd.getTime() - DAY_MS) });
    expect(before.members).toEqual({ active: 2, expiringSoon: 1 });
    expect(before.pendingReview).toBe(1);
    expect(before.totalUsers).toBe(5);
    expect(before.revenue).toEqual({ gross: grossCents / 100, refunded: 100, net: (grossCents - 10_000) / 100, paidOrders: 4 });

    // หลังหมด: เหลือคนที่ต่ออายุไว้ (ช่วงที่สองเริ่มต่อทันที)
    const after = await getDashboardStats(prisma, { now: new Date(firstEnd.getTime() + HOUR_MS) });
    expect(after.members).toEqual({ active: 1, expiringSoon: 0 });

    const health = await getSystemHealth(prisma, { env: {}, now: new Date(firstEnd.getTime() - DAY_MS) });
    expect(health.queues.expiringSoon).toBe(1);
  });
});

describe("Integration: system health", () => {
  it("reports database status, queue sizes and which env vars are set without exposing values", async () => {
    const env = { NEXTAUTH_SECRET: "super-secret-value-should-not-leak", RESEND_API_KEY: "" };
    const health = await getSystemHealth(prisma, { env, now: at(1) });

    expect(health.database.ok).toBe(true);
    expect(health.env.find((item) => item.key === "NEXTAUTH_SECRET")?.configured).toBe(true);
    expect(health.env.find((item) => item.key === "RESEND_API_KEY")?.configured).toBe(false);
    expect(JSON.stringify(health)).not.toContain("super-secret-value-should-not-leak");
    expect(health.payments.open).toBe(true);
    expect(health.queues).toHaveProperty("pendingReview");
  });
});
