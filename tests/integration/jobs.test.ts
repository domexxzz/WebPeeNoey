import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "crypto";
import { SITE_PLANS } from "@/config/plans";
import { seedDatabase, SYSTEM_SETTING_ID } from "@/lib/db/seed";
import { createOrder, submitSlip } from "@/lib/orders/checkout";
import { approveOrder, refundOrder } from "@/lib/admin/order-review";
import { setProvisioning } from "@/lib/admin/members";
import { countPendingDeprovision } from "@/lib/admin/dashboard";
import { expireSubscriptions, maskEmail, runExpiryJob, sendExpiryReminders, type ReminderDelivery } from "@/lib/jobs/expiry";
import { JOB_NAMES, runJob } from "@/lib/jobs/job-run";
import { runWatchdog, type WebhookCheck } from "@/lib/jobs/watchdog";
import { createTestPrisma, resetDatabase } from "./helpers";

const prisma = createTestPrisma();
const T0 = new Date("2026-10-11T03:00:00Z");
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const at = (minutes: number) => new Date(T0.getTime() + minutes * MINUTE_MS);
const SITE_URL = "https://example.test";
const okAlert = () => vi.fn(async (_text: string) => ({ ok: true as const }));
let adminId: string;
const actor = () => ({ id: adminId, ipAddress: "203.0.113.9" });
const slipBytes = () => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from(randomBytes(32))]);

async function member() {
  return prisma.user.create({ data: { email: `m-${randomBytes(4).toString("hex")}@example.com`, role: "USER", passwordHash: "x", tradingViewUsername: `tv_${randomBytes(3).toString("hex")}` } });
}

async function submittedOrder(userId: string, minute: number) {
  const created = await createOrder(prisma, { userId, planSlug: SITE_PLANS[0].slug, now: at(minute) });
  if (!created.ok) throw new Error(created.code);
  await submitSlip(prisma, { userId, orderId: created.orderId, bytes: slipBytes(), now: at(minute + 1) });
  return created.orderId;
}

async function approvedOrder(userId: string, minute: number) {
  const orderId = await submittedOrder(userId, minute);
  const result = await approveOrder(prisma, { orderId, actor: actor(), referenceNo: `REF${randomBytes(4).toString("hex")}`, now: at(minute + 2) });
  if (!result.ok) throw new Error(result.code);
  return { orderId, subscription: await prisma.subscription.findUniqueOrThrow({ where: { orderId } }) };
}

async function grant(subscriptionId: string, ...channels: ("tradingView" | "discord" | "telegram")[]) {
  for (const channel of channels) await setProvisioning(prisma, { subscriptionId, channel, granted: true, actor: actor() });
}

/** ทำให้ Watchdog ไม่เห็นปัญหา "งานตรวจวันหมดอายุไม่รัน" ในเทสต์ที่ไม่ได้ทดสอบเรื่องนั้น */
async function recentExpiryRun(now: Date) {
  await prisma.jobRun.create({ data: { job: JOB_NAMES.CHECK_EXPIRY, status: "SUCCESS", startedAt: new Date(now.getTime() - HOUR_MS), finishedAt: now } });
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

describe("Integration: expiry reminders (D-3)", () => {
  it("reminds each member once when their combined access ends within 3 days, skipping members who already renewed", async () => {
    const expiring = await member();
    const renewed = await member();
    const { subscription } = await approvedOrder(expiring.id, 0);
    await approvedOrder(renewed.id, 0);
    await approvedOrder(renewed.id, 10);
    const now = new Date(subscription.currentPeriodEnd.getTime() - 2 * DAY_MS);
    const send = vi.fn(async (): Promise<ReminderDelivery> => ({ email: true, telegram: false }));

    // รันซ้อนกันสองรอบ + รันซ้ำอีกรอบ → ต้องเตือนแค่ครั้งเดียว
    await Promise.all([sendExpiryReminders(prisma, { now, send }), sendExpiryReminders(prisma, { now, send })]);
    await sendExpiryReminders(prisma, { now, send });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ userId: expiring.id, email: expiring.email, planSlug: SITE_PLANS[0].slug, endsAt: subscription.currentPeriodEnd }),
    );
    expect(await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).toMatchObject({ status: "EXPIRING_SOON", expiryReminderSentAt: now });
  });

  it("puts the reminder back in the queue when every channel failed, then delivers it on the next run", async () => {
    const user = await member();
    const { subscription } = await approvedOrder(user.id, 0);
    const now = new Date(subscription.currentPeriodEnd.getTime() - DAY_MS);

    const failed = await sendExpiryReminders(prisma, { now, send: async () => ({ email: false, telegram: false }) });
    expect(failed).toEqual({ reminded: 0, failed: [{ userId: user.id, email: user.email }], hasMore: false });
    expect(await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).toMatchObject({ status: "ACTIVE", expiryReminderClaimedAt: null });

    const retried = await sendExpiryReminders(prisma, { now, send: async () => ({ email: false, telegram: true }) });
    expect(retried).toEqual({ reminded: 1, failed: [], hasMore: false });
  });

  it("re-sends a reminder whose claim was left behind by a run that died mid-way, but not a fresh claim", async () => {
    const user = await member();
    const { subscription } = await approvedOrder(user.id, 0);
    const now = new Date(subscription.currentPeriodEnd.getTime() - DAY_MS);
    const send = vi.fn(async (): Promise<ReminderDelivery> => ({ email: true, telegram: false }));

    await prisma.subscription.update({ where: { id: subscription.id }, data: { status: "EXPIRING_SOON", expiryReminderClaimedAt: new Date(now.getTime() - 10 * MINUTE_MS) } });
    await sendExpiryReminders(prisma, { now, send });
    expect(send).not.toHaveBeenCalled();

    await prisma.subscription.update({ where: { id: subscription.id }, data: { expiryReminderClaimedAt: new Date(now.getTime() - 31 * MINUTE_MS) } });
    await sendExpiryReminders(prisma, { now, send });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("stops taking new work once the time budget is used up and reports that more is left", async () => {
    const user = await member();
    const { subscription } = await approvedOrder(user.id, 0);
    const send = vi.fn(async (): Promise<ReminderDelivery> => ({ email: true, telegram: false }));

    const result = await sendExpiryReminders(prisma, { now: new Date(subscription.currentPeriodEnd.getTime() - DAY_MS), send, deadline: Date.now() - 1 });

    expect(result).toEqual({ reminded: 0, failed: [], hasMore: true });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("Integration: automatic expiry (Flow 6)", () => {
  it("expires ended periods, carries channel access over to a paid renewal and queues the rest for manual removal", async () => {
    const lapsed = await member();
    const renewed = await member();
    const lapsedSub = (await approvedOrder(lapsed.id, 0)).subscription;
    const firstSub = (await approvedOrder(renewed.id, 0)).subscription;
    const secondSub = (await approvedOrder(renewed.id, 10)).subscription;
    await grant(lapsedSub.id, "tradingView");
    await grant(firstSub.id, "tradingView", "discord");
    const now = new Date(firstSub.currentPeriodEnd.getTime() + HOUR_MS);

    const result = await expireSubscriptions(prisma, { now });

    expect(result.errors).toEqual([]);
    const byUser = Object.fromEntries(result.members.map((item) => [item.userId, item]));
    expect(byUser[lapsed.id]).toMatchObject({ continuing: false, pendingChannels: ["tradingViewGranted"], tradingViewUsername: lapsed.tradingViewUsername });
    expect(byUser[renewed.id]).toMatchObject({ continuing: true, pendingChannels: [] });

    const second = await prisma.subscription.findUniqueOrThrow({ where: { id: secondSub.id } });
    expect(second).toMatchObject({ status: "ACTIVE", tradingViewGranted: true, discordRoleGranted: true });
    expect(await prisma.subscription.findUniqueOrThrow({ where: { id: firstSub.id } })).toMatchObject({ status: "EXPIRED", tradingViewGranted: false });
    expect(await countPendingDeprovision(prisma)).toBe(1);

    const audits = await prisma.auditLog.findMany({ where: { action: { in: ["SUBSCRIPTION_EXPIRE", "PROVISIONING_CARRY_OVER"] } } });
    expect(audits.every((audit) => audit.actorId === null)).toBe(true);
    expect(audits.filter((audit) => audit.action === "SUBSCRIPTION_EXPIRE")).toHaveLength(2);
    expect(audits.find((audit) => audit.action === "PROVISIONING_CARRY_OVER")?.targetId).toBe(secondSub.id);

    expect((await expireSubscriptions(prisma, { now })).members).toEqual([]);
  });

  it("handles overlapping runs without expiring or auditing a member twice", async () => {
    const users = await Promise.all([member(), member(), member()]);
    let end = new Date(0);
    for (const user of users) end = (await approvedOrder(user.id, 0)).subscription.currentPeriodEnd;
    const now = new Date(end.getTime() + HOUR_MS);

    const [first, second] = await Promise.all([expireSubscriptions(prisma, { now }), expireSubscriptions(prisma, { now })]);

    expect(first.members.length + second.members.length).toBe(3);
    expect(await prisma.auditLog.count({ where: { action: "SUBSCRIPTION_EXPIRE" } })).toBe(3);
  });

  it("runs safely alongside a renewal approval for the same member (no deadlock, one consistent outcome)", async () => {
    const user = await member();
    const current = (await approvedOrder(user.id, 0)).subscription;
    const renewalOrderId = await submittedOrder(user.id, 10);
    const now = new Date(current.currentPeriodEnd.getTime() + HOUR_MS);

    const [approved, expired] = await Promise.all([
      approveOrder(prisma, { orderId: renewalOrderId, actor: actor(), referenceNo: `REF${randomBytes(4).toString("hex")}`, now }),
      expireSubscriptions(prisma, { now }),
    ]);

    expect(approved.ok).toBe(true);
    expect(expired.errors).toEqual([]);
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: current.id } })).status).toBe("EXPIRED");
    expect(await prisma.subscription.findUniqueOrThrow({ where: { orderId: renewalOrderId } })).toMatchObject({ status: "ACTIVE", currentPeriodStart: now });
  });

  it("runs safely alongside a refund of the renewal for the same member", async () => {
    const user = await member();
    const current = (await approvedOrder(user.id, 0)).subscription;
    const renewal = (await approvedOrder(user.id, 10)).subscription;
    await grant(current.id, "tradingView");
    const now = new Date(current.currentPeriodEnd.getTime() + HOUR_MS);

    const [refund, expired] = await Promise.all([
      refundOrder(prisma, { orderId: renewal.orderId, actor: actor(), amount: 100, reason: "ลูกค้าขอคืนช่วงต่ออายุ", now }),
      expireSubscriptions(prisma, { now }),
    ]);

    expect(refund.ok).toBe(true);
    expect(expired.errors).toEqual([]);
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: current.id } })).status).toBe("EXPIRED");
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: renewal.id } })).status).toBe("REVOKED");
    // สมาชิกไม่มีช่วงที่ใช้งานต่อแล้ว → TradingView ต้องอยู่ในคิวถอดสิทธิ์ ไม่ว่างานไหนจะทำก่อน
    expect(await countPendingDeprovision(prisma)).toBe(1);
  });

  it("keeps channel access on the paid renewal when the current period is refunded", async () => {
    const user = await member();
    const current = (await approvedOrder(user.id, 0)).subscription;
    const renewal = (await approvedOrder(user.id, 10)).subscription;
    await grant(current.id, "tradingView");

    const refund = await refundOrder(prisma, { orderId: current.orderId, actor: actor(), amount: 100, reason: "ลูกค้าขอคืนช่วงแรก", now: at(60) });

    expect(refund).toMatchObject({ ok: true, continuing: true });
    expect(await prisma.subscription.findUniqueOrThrow({ where: { id: renewal.id } })).toMatchObject({ tradingViewGranted: true, currentPeriodStart: at(60) });
    expect(await countPendingDeprovision(prisma)).toBe(0);
  });
});

describe("Integration: daily expiry job", () => {
  it("records a JobRun, closes stale unpaid orders and sends admins the list of channels to remove", async () => {
    const lapsed = await member();
    const { subscription } = await approvedOrder(lapsed.id, 0);
    await grant(subscription.id, "tradingView");
    const unpaid = await member();
    await createOrder(prisma, { userId: unpaid.id, planSlug: SITE_PLANS[0].slug, now: at(0) });
    const alert = okAlert();
    const now = new Date(subscription.currentPeriodEnd.getTime() + HOUR_MS);

    const outcome = await runExpiryJob(prisma, { now, alert, siteUrl: SITE_URL, sendReminder: async () => ({ email: true, telegram: false }) });

    expect(outcome).toMatchObject({ ok: true, summary: { expiredOrders: 1, expiredMembers: 1, pendingDeprovisionUserIds: [lapsed.id], errors: [], summaryDelivered: true } });
    const run = await prisma.jobRun.findFirstOrThrow({ where: { job: JOB_NAMES.CHECK_EXPIRY } });
    expect(run).toMatchObject({ status: "SUCCESS", error: null });
    expect(run.finishedAt).not.toBeNull();
    const message = alert.mock.calls[0][0];
    // ข้อความในกลุ่มแอดมินไม่มีอีเมลเต็ม (PDPA) แต่มีลิงก์ไปหน้าสมาชิกในหลังบ้าน
    expect(message).not.toContain(lapsed.email);
    expect(message).toContain(maskEmail(lapsed.email));
    expect(message).toContain(`${SITE_URL}/admin/members/${lapsed.id}`);
    expect(message).toContain(`TV: ${lapsed.tradingViewUsername}`);
    expect(message).toContain("TradingView");
  });

  it("stays quiet when there is nothing to report", async () => {
    const alert = okAlert();
    const outcome = await runExpiryJob(prisma, { now: at(0), alert, siteUrl: SITE_URL, sendReminder: async () => ({ email: true, telegram: false }) });
    expect(outcome).toMatchObject({ ok: true, summary: { summaryDelivered: null } });
    expect(alert).not.toHaveBeenCalled();
  });

  it("records an undelivered admin summary so the watchdog keeps warning about it", async () => {
    const lapsed = await member();
    const { subscription } = await approvedOrder(lapsed.id, 0);
    await grant(subscription.id, "tradingView");
    const now = new Date(subscription.currentPeriodEnd.getTime() + HOUR_MS);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = vi.fn(async () => ({ ok: false as const, reason: "NETWORK_ERROR" as const }));

    const outcome = await runExpiryJob(prisma, { now, alert: failing, siteUrl: SITE_URL, sendReminder: async () => ({ email: true, telegram: false }) });
    expect(outcome).toMatchObject({ ok: true, summary: { summaryDelivered: false } });

    const watchdog = await runWatchdog(prisma, { now: new Date(), siteUrl: SITE_URL, alert: okAlert() });
    expect(watchdog.ok && watchdog.summary.problemKeys).toContain("expiry-summary-undelivered");
  });

  it("marks the run FAILED, keeps the error and alerts admins when a job throws", async () => {
    const alert = okAlert();
    vi.spyOn(console, "error").mockImplementation(() => {});

    const outcome = await runJob(prisma, JOB_NAMES.CHECK_EXPIRY, async () => {
      throw new Error("database exploded");
    }, { alert });

    expect(outcome).toMatchObject({ ok: false, error: expect.stringContaining("database exploded") });
    const run = await prisma.jobRun.findFirstOrThrow();
    expect(run).toMatchObject({ status: "FAILED", error: expect.stringContaining("database exploded") });
    expect(run.alertedAt).not.toBeNull();
    expect(alert).toHaveBeenCalledWith(expect.stringContaining("check-expiry"));
  });
});

describe("Integration: watchdog", () => {
  it("alerts when the expiry job has not succeeded recently, throttles repeats, re-alerts later and announces recovery", async () => {
    const alert = okAlert();
    const now = at(0);

    const first = await runWatchdog(prisma, { now, siteUrl: SITE_URL, alert });
    expect(first).toMatchObject({ ok: true, summary: { healthy: false, problemKeys: ["check-expiry-stale"], alerted: true } });

    const repeat = await runWatchdog(prisma, { now: new Date(now.getTime() + HOUR_MS), siteUrl: SITE_URL, alert });
    expect(repeat).toMatchObject({ summary: { healthy: false, alerted: false, throttled: true, adminNotified: true } });

    const later = await runWatchdog(prisma, { now: new Date(now.getTime() + 7 * HOUR_MS), siteUrl: SITE_URL, alert });
    expect(later).toMatchObject({ summary: { alerted: true } });

    const fixedAt = new Date(now.getTime() + 8 * HOUR_MS);
    await recentExpiryRun(fixedAt);
    const recovered = await runWatchdog(prisma, { now: fixedAt, siteUrl: SITE_URL, alert });
    expect(recovered).toMatchObject({ summary: { healthy: true, recovered: true, alerted: true } });
    expect(alert).toHaveBeenCalledTimes(3);
    expect(alert.mock.calls[2][0]).toContain("กลับมาทำงานปกติ");
  });

  it("detects runs stuck in RUNNING and slips waiting for review for over 24 hours", async () => {
    const now = at(26 * 60);
    await recentExpiryRun(now);
    await prisma.jobRun.create({ data: { job: JOB_NAMES.CHECK_EXPIRY, startedAt: new Date(now.getTime() - HOUR_MS) } });
    const orderId = await submittedOrder((await member()).id, 0);
    await prisma.order.update({ where: { id: orderId }, data: { adminNotifiedAt: at(1) } });

    const outcome = await runWatchdog(prisma, { now, siteUrl: SITE_URL, alert: okAlert() });

    expect(outcome.ok && outcome.summary.problemKeys).toEqual(["job-stuck", "review-overdue"]);
    // งานที่ค้างถูกปิดเป็น FAILED จึงไม่ถูกนับซ้ำทุกชั่วโมง
    expect(await prisma.jobRun.count({ where: { status: "RUNNING", job: JOB_NAMES.CHECK_EXPIRY } })).toBe(0);
    expect(await prisma.jobRun.count({ where: { status: "FAILED", job: JOB_NAMES.CHECK_EXPIRY } })).toBe(1);
  });

  it("warns when ended access is still marked as granted in a channel for over 24 hours", async () => {
    const user = await member();
    const { subscription } = await approvedOrder(user.id, 0);
    await grant(subscription.id, "tradingView");
    await expireSubscriptions(prisma, { now: new Date(subscription.currentPeriodEnd.getTime() + HOUR_MS) });
    const now = new Date(Date.now() + 25 * HOUR_MS);
    await recentExpiryRun(now);

    const outcome = await runWatchdog(prisma, { now, siteUrl: SITE_URL, alert: okAlert() });

    expect(outcome.ok && outcome.summary.problemKeys).toEqual(["deprovision-overdue"]);
  });

  it("re-sends slip notifications that failed earlier and records them as delivered", async () => {
    const now = at(10);
    await recentExpiryRun(now);
    const orderId = await submittedOrder((await member()).id, 0);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const alert = okAlert();

    const outcome = await runWatchdog(prisma, { now, siteUrl: SITE_URL, alert });

    expect(outcome).toMatchObject({ summary: { healthy: true, slipsRenotified: 1 } });
    expect(alert).toHaveBeenCalledWith(expect.stringContaining(order.orderNumber));
    expect(alert.mock.calls[0][0]).toContain(`${SITE_URL}/admin/orders/${orderId}`);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).adminNotifiedAt).toEqual(now);
  });

  it("reports a problem and leaves the slip queued when Telegram is still failing", async () => {
    const now = at(10);
    await recentExpiryRun(now);
    const orderId = await submittedOrder((await member()).id, 0);
    const alert = vi.fn(async () => ({ ok: false as const, reason: "NETWORK_ERROR" as const }));

    const outcome = await runWatchdog(prisma, { now, siteUrl: SITE_URL, alert });

    // แจ้งกลุ่มแอดมินไม่ได้ → adminNotified=false ให้ Watchdog ภายนอก (GitHub Actions) แจ้งเตือนแทน
    expect(outcome).toMatchObject({ summary: { healthy: false, problemKeys: ["slip-notify-failed"], slipsRenotifyFailed: 1, alerted: false, adminNotified: false } });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).adminNotifiedAt).toBeNull();
  });

  it("checks the member bot webhook when it is enabled", async () => {
    const now = at(0);
    await recentExpiryRun(now);
    const webhookCheck: WebhookCheck = async () => ({
      ok: true,
      info: { url: "", pendingUpdateCount: 150, lastErrorDate: new Date(now.getTime() - 5 * MINUTE_MS), lastErrorMessage: "Connection refused" },
    });

    const outcome = await runWatchdog(prisma, { now, siteUrl: SITE_URL, alert: okAlert(), webhookCheck });

    expect(outcome.ok && outcome.summary.problemKeys).toEqual(["telegram-webhook-backlog", "telegram-webhook-error", "telegram-webhook-missing"]);
  });
});
