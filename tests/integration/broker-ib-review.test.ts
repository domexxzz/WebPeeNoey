import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "crypto";
import { SITE_PLANS } from "@/config/plans";
import { seedDatabase, SYSTEM_SETTING_ID } from "@/lib/db/seed";
import { createOrder, submitSlip } from "@/lib/orders/checkout";
import { approveOrder } from "@/lib/admin/order-review";
import { getMembershipSummary } from "@/lib/admin/membership";
import { getRevenueSummary } from "@/lib/admin/dashboard";
import { updateBrokerIbSettings } from "@/lib/broker-ib/settings";
import { createBrokerClaim, type BrokerClaimInput } from "@/lib/broker-ib/claims";
import { approveBrokerClaim, rejectBrokerClaim, type BrokerClaimChecks } from "@/lib/broker-ib/review";
import { createTestPrisma, resetDatabase } from "./helpers";

const prisma = createTestPrisma();
const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-10-15T03:00:00Z");
const day = (n: number) => new Date(T0.getTime() + n * DAY_MS);
const ALL_CHECKS: BrokerClaimChecks = { underIb: true, emailMatches: true, qualifies: true };

let adminId: string;
let secondAdminId: string;
const actor = (id = adminId) => ({ id, ipAddress: "203.0.113.7" });

async function member() {
  return prisma.user.create({ data: { email: `m-${randomBytes(4).toString("hex")}@example.com`, role: "USER", passwordHash: "x" } });
}

const NEW: BrokerClaimInput = { mode: "NEW", broker: "XM", platform: "MT5", accountNumber: "12345678", registeredEmail: "trader@example.com" };

async function claimFor(userId: string, input: BrokerClaimInput = NEW, now = T0) {
  const result = await createBrokerClaim(prisma, { userId, claim: input, termsVersion: "2026-10-15", ipAddress: "198.51.100.4", now });
  if (!result.ok) throw new Error(result.code);
  return result.orderId;
}

const approve = (orderId: string, now = T0, id = adminId, checks = ALL_CHECKS) => approveBrokerClaim(prisma, { orderId, actor: actor(id), checks, now });

async function setIb(enabled: boolean, overrides: Partial<Parameters<typeof updateBrokerIbSettings>[1]> = {}) {
  const result = await updateBrokerIbSettings(prisma, {
    actor: actor(),
    ibClaimsEnabled: enabled,
    xmLink: "https://clicks.pipaffiliates.com/c?c=1",
    exnessLink: "",
    xmMinDepositThb: "1000", exnessMinDepositThb: "1500", usdThbRate: "33.5",
    ...overrides,
  });
  if (!result.ok) throw new Error(result.code);
}

async function paidOrderSubmitted(userId: string, planSlug: string, now: Date) {
  const created = await createOrder(prisma, { userId, planSlug, now });
  if (!created.ok) throw new Error(created.code);
  const slip = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from(randomBytes(32))]);
  await submitSlip(prisma, { userId, orderId: created.orderId, bytes: slip, now });
  return created.orderId;
}
const ref = () => `REF${randomBytes(4).toString("hex").toUpperCase()}`;

beforeEach(async () => {
  await resetDatabase(prisma);
  await seedDatabase(prisma, { adminEmail: "admin@example.com", adminPassword: "integration-test-password" });
  adminId = (await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })).id;
  secondAdminId = (await prisma.user.create({ data: { email: "admin2@example.com", role: "ADMIN", passwordHash: "x" } })).id;
  await prisma.systemSetting.update({
    where: { id: SYSTEM_SETTING_ID },
    data: { paymentsEnabled: true, promptpayNumber: "0812345678", promptpayAccountName: "บัญชีทดสอบ" },
  });
  await setIb(true);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integration: approve a broker IB claim", () => {
  it("grants 30 days, verifies the account and writes a full audit entry", async () => {
    const user = await member();
    const orderId = await claimFor(user.id);

    const result = await approve(orderId, day(1));

    expect(result).toMatchObject({ ok: true, isRenewal: false, email: user.email, periodStart: day(1), periodEnd: day(31) });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { subscription: true, brokerAccount: true } });
    expect(order).toMatchObject({ status: "APPROVED", approvedByUserId: adminId, approvedAt: day(1) });
    expect(order.subscription).toMatchObject({ status: "ACTIVE", isPriceLocked: false, lockedPrice: null, currentPeriodStart: day(1), currentPeriodEnd: day(31) });
    expect(order.brokerAccount).toMatchObject({ status: "VERIFIED", firstVerifiedAt: day(1), lastVerifiedAt: day(1), lastVerifiedByUserId: adminId });

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "BROKER_CLAIM_APPROVE", targetId: orderId } });
    expect(audit).toMatchObject({ actorId: adminId, targetType: "Order", ipAddress: "203.0.113.7" });
    expect(audit.details).toMatchObject({
      before: { status: "CLAIM_SUBMITTED" },
      after: { status: "APPROVED" },
      broker: "XM",
      platform: "MT5",
      accountNumber: "12345678",
      minDepositUsd: 29.85,
      checks: ALL_CHECKS,
      method: "MANUAL",
      isRenewal: false,
    });
  });

  it("requires every check to be confirmed, and refuses self-approval", async () => {
    const user = await member();
    const orderId = await claimFor(user.id);
    expect(await approve(orderId, T0, adminId, { ...ALL_CHECKS, qualifies: false })).toEqual({ ok: false, code: "CHECKS_REQUIRED" });

    const self = await claimFor(adminId, { ...NEW, accountNumber: "87654321" });
    expect(await approve(self)).toEqual({ ok: false, code: "SELF_APPROVAL" });
    expect(await prisma.subscription.count()).toBe(0);
  });

  it("two admins approving at the same moment create exactly one grant", async () => {
    const user = await member();
    const orderId = await claimFor(user.id);

    const results = await Promise.all([approve(orderId, T0, adminId), approve(orderId, T0, secondAdminId)]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, code: "NOT_PENDING_REVIEW" }]);
    expect(await prisma.subscription.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "BROKER_CLAIM_APPROVE" } })).toBe(1);
  });

  it("approve and reject at the same moment: one wins and the state is consistent", async () => {
    const user = await member();
    const orderId = await claimFor(user.id);

    const [approved, rejected] = await Promise.all([
      approve(orderId),
      rejectBrokerClaim(prisma, { orderId, actor: actor(secondAdminId), reason: "ไม่พบบัญชีภายใต้ IB", releaseAccount: true, now: T0 }),
    ]);

    expect([approved.ok, rejected.ok].filter(Boolean)).toHaveLength(1);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { subscription: true, brokerAccount: true } });
    if (approved.ok) {
      expect(order.status).toBe("APPROVED");
      expect(order.brokerAccount?.status).toBe("VERIFIED");
    } else {
      expect(order.status).toBe("REJECTED");
      expect(order.subscription).toBeNull();
      expect(order.brokerAccount?.status).toBe("RELEASED");
    }
  });

  it("slip approval and IB approval can never act on each other's orders", async () => {
    const user = await member();
    const claimId = await claimFor(user.id);
    expect(await approveOrder(prisma, { orderId: claimId, actor: actor(), referenceNo: ref(), now: T0 })).toEqual({ ok: false, code: "NOT_PENDING_REVIEW" });

    const paidId = await paidOrderSubmitted((await member()).id, SITE_PLANS[0].slug, T0);
    expect(await approve(paidId)).toEqual({ ok: false, code: "NOT_PENDING_REVIEW" });
  });

  it("renewal rolls over from the end of the current grant (no lost days)", async () => {
    const user = await member();
    await approve(await claimFor(user.id), T0);

    const renewal = await claimFor(user.id, { mode: "RENEW" }, day(24));
    const result = await approve(renewal, day(25));

    expect(result).toMatchObject({ ok: true, isRenewal: true, periodStart: day(30), periodEnd: day(60) });
    expect((await getMembershipSummary(prisma, { userId: user.id, now: day(26) })).endsAt).toEqual(day(60));
  });

  it("a renewal after access lapsed starts at the approval time", async () => {
    const user = await member();
    await approve(await claimFor(user.id), T0);
    const renewal = await claimFor(user.id, { mode: "RENEW" }, day(40));
    expect(await approve(renewal, day(41))).toMatchObject({ ok: true, periodStart: day(41), periodEnd: day(71) });
  });

  it("IB and paid periods chain without overlap in both orders", async () => {
    const ibFirst = await member();
    await approve(await claimFor(ibFirst.id), T0);
    const paidAfter = await paidOrderSubmitted(ibFirst.id, SITE_PLANS[0].slug, day(1));
    await approveOrder(prisma, { orderId: paidAfter, actor: actor(), referenceNo: ref(), now: day(1) });
    const paidSub = await prisma.subscription.findUniqueOrThrow({ where: { orderId: paidAfter } });
    expect(paidSub.currentPeriodStart).toEqual(day(30));

    const paidFirst = await member();
    await approveOrder(prisma, { orderId: await paidOrderSubmitted(paidFirst.id, SITE_PLANS[0].slug, T0), actor: actor(), referenceNo: ref(), now: T0 });
    const ibAfter = await claimFor(paidFirst.id, { ...NEW, accountNumber: "99999999" }, day(25));
    expect(await approve(ibAfter, day(25))).toMatchObject({ ok: true, periodStart: day(30), periodEnd: day(60) });
  });

  it("re-checks the renewal window at approval (a paid plan approved in between)", async () => {
    const user = await member();
    const ibClaim = await claimFor(user.id, NEW, T0);
    await approveOrder(prisma, { orderId: await paidOrderSubmitted(user.id, SITE_PLANS[1].slug, T0), actor: actor(), referenceNo: ref(), now: T0 });

    expect(await approve(ibClaim, day(1))).toEqual({ ok: false, code: "NOT_IN_RENEWAL_WINDOW" });
    expect(await prisma.subscription.count({ where: { orderId: ibClaim } })).toBe(0);
  });

  it("an IB approval and a paid approval for the same member at the same moment produce contiguous periods", async () => {
    const user = await member();
    const ibClaim = await claimFor(user.id);
    const paid = await paidOrderSubmitted(user.id, SITE_PLANS[0].slug, T0);

    await Promise.all([approve(ibClaim, T0), approveOrder(prisma, { orderId: paid, actor: actor(secondAdminId), referenceNo: ref(), now: T0 })]);

    const periods = await prisma.subscription.findMany({ where: { userId: user.id }, orderBy: { currentPeriodStart: "asc" } });
    for (let i = 1; i < periods.length; i += 1) expect(periods[i].currentPeriodStart).toEqual(periods[i - 1].currentPeriodEnd);
    expect(periods[0].currentPeriodStart).toEqual(T0);
  });

  it("refuses when the account was released after the claim was submitted", async () => {
    const user = await member();
    const orderId = await claimFor(user.id);
    await prisma.brokerAccount.updateMany({ data: { status: "RELEASED", releasedAt: T0 } });
    expect(await approve(orderId)).toEqual({ ok: false, code: "ACCOUNT_RELEASED" });
  });

  it("pending claims stay reviewable after IB is switched off, against the minimum deposit promised at submission", async () => {
    const user = await member();
    const orderId = await claimFor(user.id);
    await setIb(false, { xmLink: "", xmMinDepositThb: "", exnessMinDepositThb: "" });

    const result = await approve(orderId);
    expect(result).toMatchObject({ ok: true });
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "BROKER_CLAIM_APPROVE" } });
    expect(audit.details).toMatchObject({ minDepositUsd: 29.85 });
  });

  it("free grants never count as revenue or use promo seats", async () => {
    const user = await member();
    const before = await prisma.plan.findMany({ select: { slug: true, promoEnrolledCount: true } });
    await approve(await claimFor(user.id));

    expect(await getRevenueSummary(prisma)).toMatchObject({ gross: 0, paidOrders: 0 });
    expect(await prisma.plan.findMany({ select: { slug: true, promoEnrolledCount: true } })).toEqual(before);
  });
});

describe("Integration: reject a broker IB claim", () => {
  it("requires a reason", async () => {
    const user = await member();
    const orderId = await claimFor(user.id);
    expect(await rejectBrokerClaim(prisma, { orderId, actor: actor(), reason: " ", releaseAccount: true, now: T0 })).toEqual({ ok: false, code: "REASON_REQUIRED" });
  });

  it("rejecting with release frees the account for anyone; without release the member keeps it", async () => {
    const user = await member();
    const orderId = await claimFor(user.id);

    const result = await rejectBrokerClaim(prisma, { orderId, actor: actor(), reason: "ไม่พบบัญชีภายใต้ IB ของเรา", releaseAccount: true, now: day(1) });

    expect(result).toMatchObject({ ok: true, email: user.email, reason: "ไม่พบบัญชีภายใต้ IB ของเรา" });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({ status: "REJECTED", rejectedAt: day(1), rejectionReason: "ไม่พบบัญชีภายใต้ IB ของเรา" });
    expect(await prisma.brokerAccount.findFirstOrThrow()).toMatchObject({ status: "RELEASED", releasedAt: day(1), releaseReason: "ไม่พบบัญชีภายใต้ IB ของเรา" });
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "BROKER_CLAIM_REJECT" } });
    expect(audit).toMatchObject({ actorId: adminId, ipAddress: "203.0.113.7" });
    expect(audit.details).toMatchObject({ before: { status: "CLAIM_SUBMITTED", bindingStatus: "PENDING" }, after: { status: "REJECTED", bindingStatus: "RELEASED" } });

    const other = await member();
    const second = await claimFor(other.id);
    await rejectBrokerClaim(prisma, { orderId: second, actor: actor(), reason: "ยอดฝากยังไม่ถึงขั้นต่ำ", releaseAccount: false, now: day(2) });
    expect(await prisma.brokerAccount.findFirstOrThrow()).toMatchObject({ userId: other.id, status: "PENDING" });
  });

  it("a rejected claim can be re-submitted with the same account by the same member", async () => {
    const user = await member();
    const orderId = await claimFor(user.id);
    await rejectBrokerClaim(prisma, { orderId, actor: actor(), reason: "ยอดฝากยังไม่ถึงขั้นต่ำ", releaseAccount: false, now: T0 });
    const again = await createBrokerClaim(prisma, { userId: user.id, claim: NEW, termsVersion: "2026-10-15", now: day(1) });
    expect(again).toMatchObject({ ok: true, reused: false });
  });

  it("refuses to review twice", async () => {
    const user = await member();
    const orderId = await claimFor(user.id);
    await rejectBrokerClaim(prisma, { orderId, actor: actor(), reason: "เลขบัญชีไม่ถูกต้อง", releaseAccount: true, now: T0 });
    expect(await rejectBrokerClaim(prisma, { orderId, actor: actor(), reason: "ซ้ำ", releaseAccount: true, now: T0 })).toEqual({ ok: false, code: "NOT_PENDING_REVIEW" });
    expect(await approve(orderId)).toEqual({ ok: false, code: "NOT_PENDING_REVIEW" });
  });
});
