import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "crypto";
import { SITE_PLANS } from "@/config/plans";
import { seedDatabase, SYSTEM_SETTING_ID } from "@/lib/db/seed";
import { createOrder, submitSlip } from "@/lib/orders/checkout";
import { approveOrder } from "@/lib/admin/order-review";
import { getMemberDetail, revokeMemberAccess, searchMembers, setProvisioning } from "@/lib/admin/members";
import { getMembershipSummary } from "@/lib/admin/membership";
import { expireSubscriptions, sendExpiryReminders, type ReminderTarget } from "@/lib/jobs/expiry";
import { runWatchdog } from "@/lib/jobs/watchdog";
import { updateBrokerIbSettings } from "@/lib/broker-ib/settings";
import { createBrokerClaim, type BrokerClaimInput } from "@/lib/broker-ib/claims";
import { AUTO_REJECT_REASON, approveBrokerClaim, rejectBrokerClaim, releaseBrokerAccount, revokeBrokerAccess } from "@/lib/broker-ib/review";
import { createTestPrisma, resetDatabase } from "./helpers";

const prisma = createTestPrisma();
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const T0 = new Date("2026-10-15T03:00:00Z");
const day = (n: number) => new Date(T0.getTime() + n * DAY_MS);
const CHECKS = { underIb: true, emailMatches: true, qualifies: true };
const SITE_URL = "https://example.test";

let adminId: string;
const actor = () => ({ id: adminId, ipAddress: "203.0.113.7" });

async function member() {
  return prisma.user.create({ data: { email: `m-${randomBytes(4).toString("hex")}@example.com`, role: "USER", passwordHash: "x" } });
}

const NEW = (accountNumber = "12345678"): BrokerClaimInput => ({ mode: "NEW", broker: "XM", platform: "MT5", accountNumber, registeredEmail: "trader@example.com" });

async function claimFor(userId: string, input: BrokerClaimInput = NEW(), now = T0) {
  const result = await createBrokerClaim(prisma, { userId, claim: input, termsVersion: "2026-10-15", now });
  if (!result.ok) throw new Error(result.code);
  return result.orderId;
}

async function ibMember(now = T0, accountNumber = "12345678") {
  const user = await member();
  const orderId = await claimFor(user.id, NEW(accountNumber), now);
  const approved = await approveBrokerClaim(prisma, { orderId, actor: actor(), checks: CHECKS, now });
  if (!approved.ok) throw new Error(approved.code);
  return { user, orderId };
}

async function approvedPaid(userId: string, now: Date) {
  const created = await createOrder(prisma, { userId, planSlug: SITE_PLANS[0].slug, now });
  if (!created.ok) throw new Error(created.code);
  const slip = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from(randomBytes(32))]);
  await submitSlip(prisma, { userId, orderId: created.orderId, bytes: slip, now });
  const approved = await approveOrder(prisma, { orderId: created.orderId, actor: actor(), referenceNo: `REF${randomBytes(4).toString("hex").toUpperCase()}`, now });
  if (!approved.ok) throw new Error(approved.code);
  return created.orderId;
}

beforeEach(async () => {
  await resetDatabase(prisma);
  await seedDatabase(prisma, { adminEmail: "admin@example.com", adminPassword: "integration-test-password" });
  adminId = (await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })).id;
  await prisma.systemSetting.update({
    where: { id: SYSTEM_SETTING_ID },
    data: { paymentsEnabled: true, promptpayNumber: "0812345678", promptpayAccountName: "บัญชีทดสอบ" },
  });
  const ib = await updateBrokerIbSettings(prisma, {
    actor: actor(),
    ibClaimsEnabled: true,
    xmLink: "https://clicks.pipaffiliates.com/c?c=1",
    exnessLink: "",
    xmMinDepositThb: "1000", exnessMinDepositThb: "1500", usdThbRate: "33.5",
  });
  if (!ib.ok) throw new Error(ib.code);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integration: revoke broker IB access", () => {
  it("revokes only the IB time, moves a queued paid period up to now, keeps provisioning and audits", async () => {
    const { user, orderId } = await ibMember(T0);
    const ibSub = await prisma.subscription.findUniqueOrThrow({ where: { orderId } });
    await setProvisioning(prisma, { subscriptionId: ibSub.id, channel: "tradingView", granted: true, actor: actor() });
    const paidOrder = await approvedPaid(user.id, day(1)); // คิวต่อท้าย: วันที่ 30 → 60

    const result = await revokeBrokerAccess(prisma, { userId: user.id, actor: actor(), reason: "บัญชีออกจาก IB แล้ว", releaseAccount: true, now: day(5) });

    expect(result).toEqual({ ok: true, revoked: 1, continuing: true, rejectedClaims: 0 });
    expect(await prisma.subscription.findUniqueOrThrow({ where: { id: ibSub.id } })).toMatchObject({ status: "REVOKED", revocationReason: "บัญชีออกจาก IB แล้ว", tradingViewGranted: false });
    const paid = await prisma.subscription.findUniqueOrThrow({ where: { orderId: paidOrder } });
    expect(paid).toMatchObject({ status: "ACTIVE", currentPeriodStart: day(5), currentPeriodEnd: day(35), tradingViewGranted: true });
    expect(await prisma.brokerAccount.findFirstOrThrow()).toMatchObject({ status: "RELEASED" });
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "BROKER_IB_REVOKE" } });
    expect(audit).toMatchObject({ actorId: adminId, targetType: "User", targetId: user.id, ipAddress: "203.0.113.7" });

    expect(await revokeBrokerAccess(prisma, { userId: user.id, actor: actor(), reason: "ซ้ำ", releaseAccount: false, now: day(6) })).toEqual({ ok: false, code: "NOTHING_TO_REVOKE" });
  });

  it("auto-rejects a waiting claim when revoking", async () => {
    const { user } = await ibMember(T0);
    const renewal = await claimFor(user.id, { mode: "RENEW" }, day(24));

    const result = await revokeBrokerAccess(prisma, { userId: user.id, actor: actor(), reason: "ข้อมูลเท็จ", releaseAccount: false, now: day(25) });

    expect(result).toMatchObject({ ok: true, revoked: 1, rejectedClaims: 1, continuing: false });
    // สมาชิกเห็นข้อความกลาง ๆ — เหตุผลจริงของแอดมินอยู่ใน Audit Log เท่านั้น
    expect(await prisma.order.findUniqueOrThrow({ where: { id: renewal } })).toMatchObject({ status: "REJECTED", rejectionReason: AUTO_REJECT_REASON.REVOKE });
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "BROKER_IB_REVOKE" } });
    expect(audit.details).toMatchObject({ reason: "ข้อมูลเท็จ", rejectedClaimIds: [renewal] });
  });

  it("revoke and approve at the same moment end with no live IB time and no deadlock", async () => {
    const user = await member();
    const orderId = await claimFor(user.id);

    await Promise.all([
      approveBrokerClaim(prisma, { orderId, actor: actor(), checks: CHECKS, now: T0 }),
      revokeBrokerAccess(prisma, { userId: user.id, actor: actor(), reason: "ปิดสิทธิ์", releaseAccount: true, now: T0 }),
    ]);

    const live = await prisma.subscription.count({ where: { userId: user.id, status: { in: ["ACTIVE", "EXPIRING_SOON"] } } });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    // อนุมัติก่อน → ถูกปิดทันที / ปิดก่อน → คำขอถูกปฏิเสธ แล้วการอนุมัติได้ NOT_PENDING_REVIEW
    expect(live).toBe(0);
    expect(["APPROVED", "REJECTED"]).toContain(order.status);
  });

  it("the emergency revoke-everything also revokes IB time", async () => {
    const { user } = await ibMember(T0);
    expect(await revokeMemberAccess(prisma, { userId: user.id, actor: actor(), reason: "ฉุกเฉิน", now: day(1) })).toEqual({ ok: true, revoked: 1 });
    expect((await getMembershipSummary(prisma, { userId: user.id, now: day(1) })).active).toBe(false);
  });
});

describe("Integration: release a broker account", () => {
  it("frees the account for another member, rejects waiting claims and audits", async () => {
    const holder = await member();
    const pending = await claimFor(holder.id);
    const binding = await prisma.brokerAccount.findFirstOrThrow();

    const result = await releaseBrokerAccount(prisma, { brokerAccountId: binding.id, actor: actor(), reason: "เจ้าของจริงแสดงหลักฐาน", now: day(1) });

    expect(result).toEqual({ ok: true, rejectedClaims: 1, userId: holder.id });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: pending } })).toMatchObject({ status: "REJECTED", rejectionReason: AUTO_REJECT_REASON.RELEASE });
    expect(await prisma.brokerAccount.findUniqueOrThrow({ where: { id: binding.id } })).toMatchObject({ status: "RELEASED", releaseReason: "เจ้าของจริงแสดงหลักฐาน" });
    expect(await prisma.auditLog.findFirstOrThrow({ where: { action: "BROKER_ACCOUNT_RELEASE" } })).toMatchObject({ targetType: "BrokerAccount", targetId: binding.id, actorId: adminId });

    const owner = await member();
    expect(await createBrokerClaim(prisma, { userId: owner.id, claim: NEW(), termsVersion: "2026-10-15", now: day(1) })).toMatchObject({ ok: true });
    expect(await releaseBrokerAccount(prisma, { brokerAccountId: "missing", actor: actor(), reason: "ทดสอบ", now: day(1) })).toEqual({ ok: false, code: "BROKER_ACCOUNT_NOT_FOUND" });
  });

  it("refuses to release twice", async () => {
    const holder = await member();
    await claimFor(holder.id);
    await rejectBrokerClaim(prisma, { orderId: (await prisma.order.findFirstOrThrow()).id, actor: actor(), reason: "เลขบัญชีไม่ถูกต้อง", releaseAccount: true, now: T0 });
    const binding = await prisma.brokerAccount.findFirstOrThrow();
    expect(await releaseBrokerAccount(prisma, { brokerAccountId: binding.id, actor: actor(), reason: "ทดสอบ", now: T0 })).toEqual({ ok: false, code: "ALREADY_RELEASED" });
  });
});

describe("Integration: IB grants in the automated jobs", () => {
  it("expires IB time like any period, noting when a paid period continues", async () => {
    const { user } = await ibMember(T0);
    await approvedPaid(user.id, day(1));

    const result = await expireSubscriptions(prisma, { now: day(31) });

    expect(result.members).toEqual([expect.objectContaining({ userId: user.id, continuing: true })]);
    expect(await prisma.subscription.count({ where: { userId: user.id, status: "EXPIRED" } })).toBe(1);
  });

  it("reminds IB members with the IB plan kind (so the link goes to the IB renewal page)", async () => {
    const { user } = await ibMember(T0);
    const targets: ReminderTarget[] = [];

    await sendExpiryReminders(prisma, { now: day(28), send: async (target) => (targets.push(target), { email: true, telegram: false }) });

    expect(targets).toEqual([expect.objectContaining({ userId: user.id, planKind: "BROKER_IB", planSlug: "broker-ib" })]);
  });

  it("watchdog flags claims waiting too long and re-sends claim notifications that failed", async () => {
    const now = new Date();
    const user = await member();
    const orderId = await claimFor(user.id, NEW(), now);
    await prisma.order.update({ where: { id: orderId }, data: { createdAt: new Date(now.getTime() - 25 * HOUR_MS), adminNotifiedAt: null } });
    const alert = vi.fn(async (_text: string) => ({ ok: true as const }));

    const outcome = await runWatchdog(prisma, { now, siteUrl: SITE_URL, alert });

    expect(outcome.ok && outcome.summary.problemKeys).toContain("broker-claim-overdue");
    expect(alert.mock.calls.some(([text]) => text.includes(`${SITE_URL}/admin/broker-claims/${orderId}`))).toBe(true);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).adminNotifiedAt).not.toBeNull();
  });

  it("watchdog reports when the claim notification still cannot be delivered", async () => {
    const now = new Date();
    const user = await member();
    const orderId = await claimFor(user.id, NEW(), now);
    await prisma.order.update({ where: { id: orderId }, data: { createdAt: new Date(now.getTime() - 10 * 60 * 1000) } });
    const failing = vi.fn(async (_text: string) => ({ ok: false as const, reason: "NETWORK_ERROR" as const }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const outcome = await runWatchdog(prisma, { now, siteUrl: SITE_URL, alert: failing });

    expect(outcome.ok && outcome.summary.problemKeys).toContain("broker-claim-notify-failed");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).adminNotifiedAt).toBeNull();
  });
});

describe("Integration: admin member views include the broker account", () => {
  it("shows the binding and order kinds on the member page, and finds members by trading account number", async () => {
    const { user } = await ibMember(T0, "87654321");

    const detail = await getMemberDetail(prisma, { userId: user.id, now: day(1) });
    expect(detail?.brokerAccounts).toEqual([expect.objectContaining({ broker: "XM", accountNumber: "87654321", status: "VERIFIED" })]);
    expect(detail?.orders[0]).toMatchObject({ kind: "BROKER_IB" });

    const found = await searchMembers(prisma, { q: "87654321", now: day(1) });
    expect(found.items.map((item) => item.id)).toEqual([user.id]);
  });
});

describe("Integration: claims racing revoke and release", () => {
  it("a claim submitted while the member's IB access is revoked never ends up waiting in the queue unseen", async () => {
    const { user } = await ibMember(T0);
    const results = await Promise.all([
      createBrokerClaim(prisma, { userId: user.id, claim: { mode: "RENEW" }, termsVersion: "2026-10-15", now: day(25) }),
      revokeBrokerAccess(prisma, { userId: user.id, actor: actor(), reason: "ปิดสิทธิ์", releaseAccount: true, now: day(25) }),
    ]);
    expect(results[1]).toMatchObject({ ok: true });
    // ยื่นก่อน → ถูกปฏิเสธอัตโนมัติ / ยื่นหลัง → ไม่มีบัญชีที่ยืนยันแล้ว
    expect(await prisma.order.count({ where: { userId: user.id, kind: "BROKER_IB", status: "CLAIM_SUBMITTED" } })).toBe(0);
  });

  it("a claim for an account being released either is auto-rejected or lands on the released row as a fresh claim", async () => {
    const holder = await member();
    await claimFor(holder.id);
    const binding = await prisma.brokerAccount.findFirstOrThrow();
    const other = await member();

    await Promise.all([
      releaseBrokerAccount(prisma, { brokerAccountId: binding.id, actor: actor(), reason: "ทดสอบ", now: day(1) }),
      createBrokerClaim(prisma, { userId: other.id, claim: NEW(), termsVersion: "2026-10-15", now: day(1) }),
    ]);

    const waiting = await prisma.order.findMany({ where: { kind: "BROKER_IB", status: "CLAIM_SUBMITTED" }, include: { brokerAccount: true } });
    for (const order of waiting) expect(order.brokerAccount).toMatchObject({ userId: order.userId, status: "PENDING" });
  });
});

describe("Integration: member search by trading account", () => {
  it("does not match every account holder for queries without digits", async () => {
    await ibMember(T0, "87654321");
    // ไม่มีตัวเลข และไม่ตรงกับอีเมล/ชื่อใด (อีเมลทดสอบเป็น m-<hex>@example.com จึงห้ามใช้ "-")
    expect((await searchMembers(prisma, { q: "zzz", now: day(1) })).total).toBe(0);
    expect((await searchMembers(prisma, { q: "8765 4321", now: day(1) })).total).toBe(1);
  });
});
