import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "crypto";
import { SITE_PLANS } from "@/config/plans";
import { seedDatabase, SYSTEM_SETTING_ID } from "@/lib/db/seed";
import { createOrder, submitSlip } from "@/lib/orders/checkout";
import { approveOrder, refundOrder, rejectOrder } from "@/lib/admin/order-review";
import { getMembershipSummary } from "@/lib/admin/membership";
import { createTestPrisma, resetDatabase } from "./helpers";

const prisma = createTestPrisma();
const MONTHLY = SITE_PLANS[0];
const QUARTERLY = SITE_PLANS[1];
const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-10-11T03:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60 * 1000);

let adminId: string;

async function member() {
  return prisma.user.create({ data: { email: `m-${randomBytes(4).toString("hex")}@example.com`, role: "USER", passwordHash: "x" } });
}

/** ออเดอร์ที่แนบสลิปแล้ว รอแอดมินตรวจ */
async function submittedOrder(userId: string, planSlug = MONTHLY.slug, now = T0) {
  const created = await createOrder(prisma, { userId, planSlug, now });
  if (!created.ok) throw new Error(created.code);
  const slip = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from(randomBytes(32))]);
  const submitted = await submitSlip(prisma, { userId, orderId: created.orderId, bytes: slip, now: new Date(now.getTime() + 60_000) });
  if (!submitted.ok) throw new Error(submitted.code);
  return created.orderId;
}

const ref = () => `REF${randomBytes(5).toString("hex").toUpperCase()}`;
const actor = () => ({ id: adminId, ipAddress: "203.0.113.9" });

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

describe("Integration: approve order", () => {
  it("approves, records the bank reference, creates the subscription and writes an audit log", async () => {
    const user = await member();
    const orderId = await submittedOrder(user.id);

    const result = await approveOrder(prisma, { orderId, actor: actor(), referenceNo: " ref 123-abc ", now: at(10) });

    expect(result).toMatchObject({ ok: true });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payment: true, subscription: true } });
    expect(order.status).toBe("APPROVED");
    expect(order.approvedByUserId).toBe(adminId);
    expect(order.payment?.referenceNo).toBe("REF123ABC");
    expect(order.payment?.verifiedAt?.getTime()).toBe(at(10).getTime());
    expect(order.subscription?.currentPeriodStart.getTime()).toBe(at(10).getTime());
    expect(order.subscription?.currentPeriodEnd.getTime()).toBe(at(10).getTime() + MONTHLY.durationDays * DAY_MS);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "ORDER_APPROVE", targetId: orderId } });
    expect(audit).toMatchObject({ actorId: adminId, targetType: "Order", ipAddress: "203.0.113.9" });
    expect(audit.details).toMatchObject({ before: { status: "SLIP_SUBMITTED" }, after: { status: "APPROVED" }, referenceNo: "REF123ABC" });
  });

  it("stacks renewal days on top of the current membership (rollover)", async () => {
    const user = await member();
    await approveOrder(prisma, { orderId: await submittedOrder(user.id), actor: actor(), referenceNo: ref(), now: at(10) });
    const firstEnd = at(10).getTime() + MONTHLY.durationDays * DAY_MS;

    const renewal = await submittedOrder(user.id, QUARTERLY.slug, at(20));
    await approveOrder(prisma, { orderId: renewal, actor: actor(), referenceNo: ref(), now: at(30) });

    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { orderId: renewal } });
    expect(subscription.currentPeriodStart.getTime()).toBe(firstEnd);
    expect(subscription.currentPeriodEnd.getTime()).toBe(firstEnd + QUARTERLY.durationDays * DAY_MS);
    expect((await getMembershipSummary(prisma, { userId: user.id, now: at(31) })).endsAt?.getTime()).toBe(firstEnd + QUARTERLY.durationDays * DAY_MS);
  });

  it("starts from the approval time when the previous membership already expired", async () => {
    const user = await member();
    await approveOrder(prisma, { orderId: await submittedOrder(user.id), actor: actor(), referenceNo: ref(), now: at(10) });
    const later = new Date(at(10).getTime() + (MONTHLY.durationDays + 5) * DAY_MS);

    const renewal = await submittedOrder(user.id, MONTHLY.slug, later);
    await approveOrder(prisma, { orderId: renewal, actor: actor(), referenceNo: ref(), now: later });

    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { orderId: renewal } });
    expect(subscription.currentPeriodStart.getTime()).toBe(later.getTime());
  });

  it("is idempotent: two admins approving at the same moment create exactly one subscription", async () => {
    const orderId = await submittedOrder((await member()).id);

    const results = await Promise.all([
      approveOrder(prisma, { orderId, actor: actor(), referenceNo: ref(), now: at(10) }),
      approveOrder(prisma, { orderId, actor: actor(), referenceNo: ref(), now: at(10) }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.code === "NOT_PENDING_REVIEW")).toHaveLength(1);
    expect(await prisma.subscription.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "ORDER_APPROVE" } })).toBe(1);
  });

  it("never overlaps periods when two orders of the same member are approved concurrently", async () => {
    const user = await member();
    const [first, second] = [await submittedOrder(user.id, MONTHLY.slug), await submittedOrder(user.id, QUARTERLY.slug)];

    await Promise.all([
      approveOrder(prisma, { orderId: first, actor: actor(), referenceNo: ref(), now: at(10) }),
      approveOrder(prisma, { orderId: second, actor: actor(), referenceNo: ref(), now: at(10) }),
    ]);

    const periods = (await prisma.subscription.findMany({ where: { userId: user.id }, orderBy: { currentPeriodStart: "asc" } })).map(
      (subscription) => [subscription.currentPeriodStart.getTime(), subscription.currentPeriodEnd.getTime()],
    );
    expect(periods).toHaveLength(2);
    expect(periods[1][0]).toBe(periods[0][1]);
  });

  it("requires a bank reference and refuses one that was already used", async () => {
    const [first, second] = [await submittedOrder((await member()).id), await submittedOrder((await member()).id)];
    expect(await approveOrder(prisma, { orderId: first, actor: actor(), referenceNo: "  ", now: at(10) })).toEqual({ ok: false, code: "REFERENCE_REQUIRED" });

    await approveOrder(prisma, { orderId: first, actor: actor(), referenceNo: "SAME-REF-1", now: at(10) });
    expect(await approveOrder(prisma, { orderId: second, actor: actor(), referenceNo: "same ref 1", now: at(11) })).toEqual({
      ok: false,
      code: "DUPLICATE_REFERENCE",
    });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: second } })).status).toBe("SLIP_SUBMITTED");
  });

  it("counts promo seats and grants the lifetime price lock for promo orders", async () => {
    const orderId = await submittedOrder((await member()).id);

    await approveOrder(prisma, { orderId, actor: actor(), referenceNo: ref(), now: at(10) });

    expect((await prisma.plan.findUniqueOrThrow({ where: { slug: MONTHLY.slug } })).promoEnrolledCount).toBe(1);
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { orderId } });
    expect(subscription.isPriceLocked).toBe(true);
    expect(subscription.lockedPrice?.toNumber()).toBe(MONTHLY.price);
  });

  it("flags promo oversell in the audit log instead of silently exceeding the limit", async () => {
    const orderId = await submittedOrder((await member()).id);
    await prisma.plan.update({ where: { slug: MONTHLY.slug }, data: { promoEnrolledCount: MONTHLY.promoLimit } });

    const result = await approveOrder(prisma, { orderId, actor: actor(), referenceNo: ref(), now: at(10) });

    expect(result).toMatchObject({ ok: true, promoOversold: true });
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "ORDER_APPROVE", targetId: orderId } });
    expect(audit.details).toMatchObject({ promoOversold: true });
  });

  it("does not let an admin approve their own order (separation of duties)", async () => {
    const orderId = await submittedOrder(adminId);
    expect(await approveOrder(prisma, { orderId, actor: actor(), referenceNo: ref(), now: at(10) })).toEqual({ ok: false, code: "SELF_APPROVAL" });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("SLIP_SUBMITTED");
  });

  it("does not consume another promo seat for a member who already holds a price lock on the plan", async () => {
    const user = await member();
    await approveOrder(prisma, { orderId: await submittedOrder(user.id), actor: actor(), referenceNo: ref(), now: at(10) });
    // ออเดอร์ที่สองถูกตั้งราคาเป็น PROMO ไว้ก่อนออเดอร์แรกได้รับอนุมัติ
    const second = await submittedOrder(user.id, MONTHLY.slug, at(1));
    await prisma.order.update({ where: { id: second }, data: { priceReason: "PROMO" } });

    await approveOrder(prisma, { orderId: second, actor: actor(), referenceNo: ref(), now: at(20) });

    expect((await prisma.plan.findUniqueOrThrow({ where: { slug: MONTHLY.slug } })).promoEnrolledCount).toBe(1);
  });

  it("refuses orders that are not waiting for review", async () => {
    const user = await member();
    const created = await createOrder(prisma, { userId: user.id, planSlug: MONTHLY.slug, now: T0 });
    const pendingId = created.ok ? created.orderId : "";
    expect(await approveOrder(prisma, { orderId: pendingId, actor: actor(), referenceNo: ref(), now: at(1) })).toEqual({ ok: false, code: "NOT_PENDING_REVIEW" });
    expect(await approveOrder(prisma, { orderId: "missing", actor: actor(), referenceNo: ref(), now: at(1) })).toEqual({ ok: false, code: "ORDER_NOT_FOUND" });
  });
});

describe("Integration: reject order", () => {
  it("rejects with a reason, keeps the slip blocked and writes an audit log", async () => {
    const orderId = await submittedOrder((await member()).id);

    const result = await rejectOrder(prisma, { orderId, actor: actor(), reason: "ยอดเงินไม่ตรงกับคำสั่งซื้อ", now: at(10) });

    expect(result).toMatchObject({ ok: true });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({ status: "REJECTED", rejectionReason: "ยอดเงินไม่ตรงกับคำสั่งซื้อ" });
    expect(await prisma.slipUpload.count({ where: { orderId } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "ORDER_REJECT", targetId: orderId } })).toBe(1);
  });

  it("requires a meaningful reason and only rejects orders under review", async () => {
    const orderId = await submittedOrder((await member()).id);
    expect(await rejectOrder(prisma, { orderId, actor: actor(), reason: " ", now: at(10) })).toEqual({ ok: false, code: "REASON_REQUIRED" });

    await rejectOrder(prisma, { orderId, actor: actor(), reason: "สลิปไม่ชัด", now: at(10) });
    expect(await rejectOrder(prisma, { orderId, actor: actor(), reason: "สลิปไม่ชัด", now: at(11) })).toEqual({ ok: false, code: "NOT_PENDING_REVIEW" });
  });
});

describe("Integration: refund order", () => {
  async function approved() {
    const user = await member();
    const orderId = await submittedOrder(user.id);
    await approveOrder(prisma, { orderId, actor: actor(), referenceNo: ref(), now: at(10) });
    return { user, orderId };
  }

  it("refunds an approved order, revokes its subscription and writes an audit log", async () => {
    const { user, orderId } = await approved();
    const amount = (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).amount.toNumber();

    const result = await refundOrder(prisma, { orderId, actor: actor(), amount, reason: "ลูกค้าขอคืนภายใน 7 วัน", transferReference: "RF-1", now: at(60) });

    expect(result).toMatchObject({ ok: true });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("REFUNDED");
    expect(await prisma.refund.findUniqueOrThrow({ where: { orderId } })).toMatchObject({ processedByUserId: adminId, transferReference: "RF-1" });
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { orderId } });
    expect(subscription.status).toBe("REVOKED");
    expect(subscription.revokedAt?.getTime()).toBe(at(60).getTime());
    expect((await getMembershipSummary(prisma, { userId: user.id, now: at(61) })).active).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: "ORDER_REFUND", targetId: orderId } })).toBe(1);
  });

  it("refunds at most once even when submitted twice at the same time", async () => {
    const { orderId } = await approved();
    const amount = (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).amount.toNumber();

    const results = await Promise.all([
      refundOrder(prisma, { orderId, actor: actor(), amount, reason: "ซ้ำ", now: at(60) }),
      refundOrder(prisma, { orderId, actor: actor(), amount, reason: "ซ้ำ", now: at(60) }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await prisma.refund.count()).toBe(1);
  });

  it("moves later rollover periods forward when an earlier order in the chain is refunded", async () => {
    const user = await member();
    const first = await submittedOrder(user.id);
    await approveOrder(prisma, { orderId: first, actor: actor(), referenceNo: ref(), now: at(10) });
    const second = await submittedOrder(user.id, QUARTERLY.slug, at(20));
    await approveOrder(prisma, { orderId: second, actor: actor(), referenceNo: ref(), now: at(30) });
    const amount = (await prisma.order.findUniqueOrThrow({ where: { id: first } })).amount.toNumber();

    await refundOrder(prisma, { orderId: first, actor: actor(), amount, reason: "คืนเงินออเดอร์แรก", now: at(60) });

    const moved = await prisma.subscription.findUniqueOrThrow({ where: { orderId: second } });
    expect(moved.currentPeriodStart.getTime()).toBe(at(60).getTime());
    expect(moved.currentPeriodEnd.getTime()).toBe(at(60).getTime() + QUARTERLY.durationDays * DAY_MS);
    const summary = await getMembershipSummary(prisma, { userId: user.id, now: at(61) });
    expect(summary.active).toBe(true);
    expect(summary.endsAt?.getTime()).toBe(moved.currentPeriodEnd.getTime());
  });

  it("refuses refunds above the paid amount, without a reason, or for orders that were not approved", async () => {
    const { orderId } = await approved();
    const amount = (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).amount.toNumber();
    expect(await refundOrder(prisma, { orderId, actor: actor(), amount: amount + 1, reason: "เกิน", now: at(60) })).toEqual({ ok: false, code: "INVALID_AMOUNT" });
    expect(await refundOrder(prisma, { orderId, actor: actor(), amount: 0, reason: "ศูนย์", now: at(60) })).toEqual({ ok: false, code: "INVALID_AMOUNT" });
    expect(await refundOrder(prisma, { orderId, actor: actor(), amount, reason: "", now: at(60) })).toEqual({ ok: false, code: "REASON_REQUIRED" });

    const review = await submittedOrder((await member()).id);
    expect(await refundOrder(prisma, { orderId: review, actor: actor(), amount: 1, reason: "ยังไม่อนุมัติ", now: at(60) })).toEqual({ ok: false, code: "NOT_REFUNDABLE" });
  });
});
