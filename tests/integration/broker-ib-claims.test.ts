import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "crypto";
import { SITE_PLANS } from "@/config/plans";
import { BROKER_IB_PLAN } from "@/config/broker-ib";
import { seedDatabase, SYSTEM_SETTING_ID } from "@/lib/db/seed";
import { createOrder, submitSlip } from "@/lib/orders/checkout";
import { approveOrder } from "@/lib/admin/order-review";
import { updateBrokerIbSettings } from "@/lib/broker-ib/settings";
import { createBrokerClaim, type BrokerClaimInput } from "@/lib/broker-ib/claims";
import { BROKER_IB_RULES } from "@/config/broker-ib";
import { createTestPrisma, resetDatabase } from "./helpers";

const prisma = createTestPrisma();
const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-10-15T03:00:00Z");
const day = (n: number) => new Date(T0.getTime() + n * DAY_MS);
const TERMS = "2026-10-15";

let adminId: string;
const actor = () => ({ id: adminId, ipAddress: "203.0.113.7" });

async function member() {
  return prisma.user.create({ data: { email: `m-${randomBytes(4).toString("hex")}@example.com`, role: "USER", passwordHash: "x" } });
}

const newClaim = (accountNumber = "12345678", overrides: Partial<Extract<BrokerClaimInput, { mode: "NEW" }>> = {}): BrokerClaimInput => ({
  mode: "NEW",
  broker: "XM",
  platform: "MT5",
  accountNumber,
  registeredEmail: "Trader@Example.com",
  ...overrides,
});

const claim = (userId: string, input: BrokerClaimInput = newClaim(), now = T0) =>
  createBrokerClaim(prisma, { userId, claim: input, termsVersion: TERMS, ipAddress: "198.51.100.4", now });

async function openIb(overrides: Partial<Parameters<typeof updateBrokerIbSettings>[1]> = {}) {
  const result = await updateBrokerIbSettings(prisma, {
    actor: actor(),
    ibClaimsEnabled: true,
    xmLink: "https://clicks.pipaffiliates.com/c?c=1",
    exnessLink: "https://one.exnesstrack.org/a/abc",
    xmMinDepositThb: "1000", exnessMinDepositThb: "1500", usdThbRate: "33.5",
    ...overrides,
  });
  if (!result.ok) throw new Error(result.code);
}

/** สมาชิกที่มีสิทธิ์แบบชำระเงิน (ผ่านเส้นทางจริง: สร้างออเดอร์ → แนบสลิป → อนุมัติ) */
async function paidMember(planSlug = SITE_PLANS[0].slug, now = T0) {
  const user = await member();
  const created = await createOrder(prisma, { userId: user.id, planSlug, now });
  if (!created.ok) throw new Error(created.code);
  const slip = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from(randomBytes(32))]);
  await submitSlip(prisma, { userId: user.id, orderId: created.orderId, bytes: slip, now });
  const approved = await approveOrder(prisma, { orderId: created.orderId, actor: actor(), referenceNo: `REF${randomBytes(4).toString("hex").toUpperCase()}`, now });
  if (!approved.ok) throw new Error(approved.code);
  return user;
}

beforeEach(async () => {
  await resetDatabase(prisma);
  await seedDatabase(prisma, { adminEmail: "admin@example.com", adminPassword: "integration-test-password" });
  adminId = (await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })).id;
  await prisma.systemSetting.update({
    where: { id: SYSTEM_SETTING_ID },
    data: { paymentsEnabled: true, promptpayNumber: "0812345678", promptpayAccountName: "บัญชีทดสอบ" },
  });
  await openIb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integration: submit a broker IB claim", () => {
  it("binds the trading account and opens a free claim order waiting for admin review", async () => {
    const user = await member();
    const result = await claim(user.id, newClaim(" 12 345-678 "));

    expect(result).toMatchObject({ ok: true, reused: false, isRenewal: false, broker: "XM", accountMasked: "****5678" });
    if (!result.ok) return;
    expect(result.orderNumber).toMatch(/^IB-\d{8}-[0-9A-F]{6}$/);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { payment: true, plan: true, brokerAccount: true } });
    expect(order).toMatchObject({ status: "CLAIM_SUBMITTED", kind: "BROKER_IB", termsVersion: TERMS, createdIp: "198.51.100.4", payment: null });
    expect(order.amount.toNumber()).toBe(0);
    expect(order.ibMinDepositThb?.toNumber()).toBe(1000);
    expect(order.ibUsdThbRate?.toNumber()).toBe(33.5);
    expect(order.ibMinDepositUsd?.toNumber()).toBe(29.85); // 1,000 บาท ที่อัตรา 33.5
    expect(order.plan.slug).toBe(BROKER_IB_PLAN.slug);
    expect(order.brokerAccount).toMatchObject({
      userId: user.id,
      broker: "XM",
      platform: "MT5",
      accountNumber: "12345678",
      registeredEmail: "trader@example.com",
      status: "PENDING",
    });
  });

  it("refuses when IB is closed or the broker has no link, writing nothing", async () => {
    const user = await member();
    await openIb({ exnessLink: "" });
    expect(await claim(user.id, newClaim("12345678", { broker: "EXNESS" }))).toEqual({ ok: false, code: "BROKER_NOT_OFFERED" });

    await openIb({ ibClaimsEnabled: false });
    expect(await claim(user.id)).toEqual({ ok: false, code: "IB_CLOSED" });
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.brokerAccount.count()).toBe(0);
  });

  it("validates the account number and broker email", async () => {
    const user = await member();
    expect(await claim(user.id, newClaim("12ab"))).toEqual({ ok: false, code: "INVALID_ACCOUNT_NUMBER" });
    expect(await claim(user.id, newClaim("12345678", { registeredEmail: "nope" }))).toEqual({ ok: false, code: "INVALID_EMAIL" });
  });

  it("refuses an account another member holds (pending or verified) — formatting differences don't help", async () => {
    const [first, second] = [await member(), await member()];
    expect(await claim(first.id, newClaim("12345678"))).toMatchObject({ ok: true });
    expect(await claim(second.id, newClaim("1234-5678"))).toEqual({ ok: false, code: "ACCOUNT_CLAIMED" });

    await prisma.brokerAccount.updateMany({ data: { status: "VERIFIED" } });
    expect(await claim(second.id, newClaim("12345678"))).toEqual({ ok: false, code: "ACCOUNT_CLAIMED" });
  });

  it("the same login at another broker is a different account, but switching MT4/MT5 or adding leading zeros is not", async () => {
    const [first, second, third, fourth] = [await member(), await member(), await member(), await member()];
    expect(await claim(first.id, newClaim("12345678"))).toMatchObject({ ok: true });
    expect(await claim(second.id, newClaim("12345678", { broker: "EXNESS" }))).toMatchObject({ ok: true });
    expect(await claim(third.id, newClaim("12345678", { platform: "MT4" }))).toEqual({ ok: false, code: "ACCOUNT_CLAIMED" });
    expect(await claim(fourth.id, newClaim("0012345678"))).toEqual({ ok: false, code: "ACCOUNT_CLAIMED" });
  });

  it("does not let a member overwrite the email or platform of an account the admin already verified", async () => {
    const user = await member();
    await claim(user.id, newClaim("12345678"));
    await prisma.order.updateMany({ where: { kind: "BROKER_IB" }, data: { status: "REJECTED" } });
    await prisma.brokerAccount.updateMany({ data: { status: "VERIFIED", firstVerifiedAt: T0 } });

    expect(await claim(user.id, newClaim("12345678", { registeredEmail: "other@example.com", platform: "MT4" }))).toMatchObject({ ok: true, isRenewal: true });
    expect(await prisma.brokerAccount.findFirstOrThrow()).toMatchObject({ registeredEmail: "trader@example.com", platform: "MT5" });
  });

  it("race: two members claim the same account at once — exactly one wins", async () => {
    const [first, second] = [await member(), await member()];
    const results = await Promise.all([claim(first.id), claim(second.id)]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, code: "ACCOUNT_CLAIMED" }]);
    expect(await prisma.brokerAccount.count()).toBe(1);
    expect(await prisma.order.count({ where: { kind: "BROKER_IB" } })).toBe(1);
  });

  it("the database itself refuses a duplicate (broker, platform, account) binding", async () => {
    const [first, second] = [await member(), await member()];
    const data = { broker: "XM", platform: "MT5", accountNumber: "55555555", registeredEmail: "a@example.com" } as const;
    await prisma.brokerAccount.create({ data: { ...data, userId: first.id } });
    await expect(prisma.brokerAccount.create({ data: { ...data, platform: "MT4", userId: second.id } })).rejects.toMatchObject({ code: "P2002" });
  });

  it("double submit by the same member returns the same claim instead of a second one", async () => {
    const user = await member();
    const [a, b] = await Promise.all([claim(user.id), claim(user.id)]);

    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.orderId).toBe(b.orderId);
    expect([a.reused, b.reused].sort()).toEqual([false, true]);
    expect(await prisma.order.count({ where: { kind: "BROKER_IB" } })).toBe(1);
  });

  it("one claim at a time, and one trading account per member", async () => {
    const user = await member();
    await claim(user.id, newClaim("11111111"));
    expect(await claim(user.id, newClaim("22222222"))).toEqual({ ok: false, code: "CLAIM_ALREADY_PENDING" });

    await prisma.order.updateMany({ where: { kind: "BROKER_IB" }, data: { status: "REJECTED" } });
    await prisma.brokerAccount.updateMany({ data: { status: "VERIFIED" } });
    expect(await claim(user.id, newClaim("22222222"))).toEqual({ ok: false, code: "ALREADY_HAS_ACCOUNT" });
  });

  it("renewal needs an account that was verified before", async () => {
    const user = await member();
    expect(await claim(user.id, { mode: "RENEW" })).toEqual({ ok: false, code: "NO_VERIFIED_ACCOUNT" });
  });

  it("stacking: a member whose access outlasts the renewal window must wait", async () => {
    const user = await paidMember(SITE_PLANS[0].slug, T0); // 30 วัน: สิ้นสุดวันที่ 30
    const paidEnd = day(SITE_PLANS[0].durationDays);
    const opensAt = new Date(paidEnd.getTime() - BROKER_IB_RULES.renewalWindowDays * DAY_MS);

    const early = await claim(user.id, newClaim(), day(10));
    expect(early).toEqual({ ok: false, code: "NOT_IN_RENEWAL_WINDOW", opensAt });

    expect(await claim(user.id, newClaim(), opensAt)).toMatchObject({ ok: true });
  });

  it("an account released by its previous holder can be claimed by someone else (same row is reused)", async () => {
    const [first, second] = [await member(), await member()];
    await claim(first.id);
    const binding = await prisma.brokerAccount.findFirstOrThrow();
    await prisma.order.updateMany({ where: { kind: "BROKER_IB" }, data: { status: "REJECTED" } });
    await prisma.brokerAccount.update({
      where: { id: binding.id },
      data: { status: "RELEASED", releasedAt: T0, releaseReason: "ทดสอบ", firstVerifiedAt: T0, lastVerifiedAt: T0, lastVerifiedByUserId: adminId },
    });

    expect(await claim(second.id, newClaim("12345678", { registeredEmail: "second@example.com" }))).toMatchObject({ ok: true, isRenewal: false });
    const reused = await prisma.brokerAccount.findUniqueOrThrow({ where: { id: binding.id } });
    expect(reused).toMatchObject({
      userId: second.id,
      status: "PENDING",
      registeredEmail: "second@example.com",
      firstVerifiedAt: null,
      lastVerifiedAt: null,
      lastVerifiedByUserId: null,
      releasedAt: null,
      releaseReason: null,
    });
    expect(await prisma.brokerAccount.count()).toBe(1);
  });
});
