import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "crypto";
import { SITE_PLANS } from "@/config/plans";
import { PAYMENT_RULES } from "@/config/payment";
import { seedDatabase, SYSTEM_SETTING_ID } from "@/lib/db/seed";
import { createOrder, getOrderForUser, getPaymentAvailability, markAdminNotified, submitSlip } from "@/lib/orders/checkout";
import { createTestPrisma, resetDatabase } from "./helpers";

const prisma = createTestPrisma();
const MONTHLY = SITE_PLANS[0];
const T0 = new Date("2026-10-11T03:00:00Z");
const minutes = (value: number) => value * 60 * 1000;
const at = (offsetMinutes: number) => new Date(T0.getTime() + minutes(offsetMinutes));

/** ไฟล์ PNG ที่ไม่ซ้ำกัน (หัวไฟล์ PNG + ข้อมูลสุ่ม) */
function fakeSlip(): Uint8Array {
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from(randomBytes(64))]);
}

async function createMember(email = `member-${randomBytes(4).toString("hex")}@example.com`) {
  return prisma.user.create({ data: { email, role: "USER", passwordHash: "x" } });
}

async function openPayments() {
  await prisma.systemSetting.update({
    where: { id: SYSTEM_SETTING_ID },
    data: { paymentsEnabled: true, promptpayNumber: "0812345678", promptpayAccountName: "บัญชีทดสอบ" },
  });
}

beforeEach(async () => {
  await resetDatabase(prisma);
  await seedDatabase(prisma, { adminEmail: "admin@example.com", adminPassword: "integration-test-password" });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integration: payment availability (kill switch)", () => {
  it("is closed by default after seeding", async () => {
    expect(await getPaymentAvailability(prisma)).toEqual({ open: false, reason: "DISABLED" });
  });

  it("stays closed when payments are enabled without a valid PromptPay account", async () => {
    await prisma.systemSetting.update({ where: { id: SYSTEM_SETTING_ID }, data: { paymentsEnabled: true } });
    expect(await getPaymentAvailability(prisma)).toEqual({ open: false, reason: "NOT_CONFIGURED" });

    await prisma.systemSetting.update({ where: { id: SYSTEM_SETTING_ID }, data: { promptpayNumber: "12345", promptpayAccountName: "x" } });
    expect(await getPaymentAvailability(prisma)).toEqual({ open: false, reason: "NOT_CONFIGURED" });
  });

  it("is closed during maintenance and open once fully configured", async () => {
    await openPayments();
    expect(await getPaymentAvailability(prisma)).toEqual({ open: true, target: "0812345678", accountName: "บัญชีทดสอบ" });
    await prisma.systemSetting.update({ where: { id: SYSTEM_SETTING_ID }, data: { maintenanceMode: true } });
    expect(await getPaymentAvailability(prisma)).toEqual({ open: false, reason: "MAINTENANCE" });
  });
});

describe("Integration: create order", () => {
  it("refuses to create orders while payments are closed", async () => {
    const member = await createMember();
    expect(await createOrder(prisma, { userId: member.id, planSlug: MONTHLY.slug, now: T0 })).toEqual({ ok: false, code: "PAYMENTS_CLOSED" });
    expect(await prisma.order.count()).toBe(0);
  });

  it("creates a pending order with a PromptPay payment, satang discount and 30-minute expiry", async () => {
    await openPayments();
    const member = await createMember();

    const result = await createOrder(prisma, { userId: member.id, planSlug: MONTHLY.slug, now: T0 });

    expect(result).toMatchObject({ ok: true, reused: false });
    const order = await prisma.order.findFirstOrThrow({ include: { payment: true } });
    const amount = order.amount.toNumber();
    expect(order.status).toBe("PENDING_PAYMENT");
    expect(order.basePrice?.toNumber()).toBe(MONTHLY.price);
    expect(order.priceReason).toBe("PROMO");
    expect(order.orderNumber).toMatch(/^ORD-\d{8}-[A-F0-9]{6}$/);
    expect(amount).toBeLessThan(MONTHLY.price);
    expect(amount).toBeGreaterThanOrEqual(MONTHLY.price - 0.99);
    expect(order.expiresAt.getTime()).toBe(T0.getTime() + minutes(PAYMENT_RULES.paymentWindowMinutes));
    expect(order.payment?.amount.toNumber()).toBe(amount);
    expect(order.payment?.promptpayTarget).toBe("0812345678");
    expect(order.payment?.promptpayPayload).toContain(`54${String(amount.toFixed(2).length).padStart(2, "0")}${amount.toFixed(2)}`);
  });

  it("returns the same order for concurrent double-clicks on the same plan", async () => {
    await openPayments();
    const member = await createMember();

    const results = await Promise.all(
      Array.from({ length: 5 }, () => createOrder(prisma, { userId: member.id, planSlug: MONTHLY.slug, now: T0 })),
    );

    expect(results.every((result) => result.ok)).toBe(true);
    expect(new Set(results.map((result) => (result.ok ? result.orderId : null))).size).toBe(1);
    expect(results.filter((result) => result.ok && !result.reused)).toHaveLength(1);
    expect(await prisma.order.count()).toBe(1);
  });

  it("limits open orders per member", async () => {
    await openPayments();
    const member = await createMember();
    for (const plan of SITE_PLANS.slice(0, PAYMENT_RULES.maxOpenOrdersPerUser)) {
      expect((await createOrder(prisma, { userId: member.id, planSlug: plan.slug, now: T0 })).ok).toBe(true);
    }
    const extra = SITE_PLANS[PAYMENT_RULES.maxOpenOrdersPerUser];
    expect(await createOrder(prisma, { userId: member.id, planSlug: extra.slug, now: T0 })).toEqual({ ok: false, code: "TOO_MANY_OPEN_ORDERS" });
  });

  it("expires stale orders and creates a fresh one instead of reusing them", async () => {
    await openPayments();
    const member = await createMember();
    const first = await createOrder(prisma, { userId: member.id, planSlug: MONTHLY.slug, now: T0 });
    const later = at(PAYMENT_RULES.paymentWindowMinutes + PAYMENT_RULES.slipUploadGraceMinutes + 1);

    const second = await createOrder(prisma, { userId: member.id, planSlug: MONTHLY.slug, now: later });

    expect(second).toMatchObject({ ok: true, reused: false });
    expect(first.ok && second.ok && first.orderId !== second.orderId).toBe(true);
    const stale = await prisma.order.findUniqueOrThrow({ where: { id: first.ok ? first.orderId : "" } });
    expect(stale.status).toBe("EXPIRED");
  });

  it("gives concurrent open orders with the same price different satang amounts", async () => {
    await openPayments();
    const [alice, bob] = [await createMember(), await createMember()];
    await createOrder(prisma, { userId: alice.id, planSlug: MONTHLY.slug, now: T0, random: () => 0 });
    await createOrder(prisma, { userId: bob.id, planSlug: MONTHLY.slug, now: T0, random: () => 0 });

    const amounts = (await prisma.order.findMany()).map((order) => order.amount.toNumber());
    expect(new Set(amounts).size).toBe(2);
    expect(amounts.sort()).toEqual([MONTHLY.price - 0.02, MONTHLY.price - 0.01]);
  });

  it("charges the locked price for members with a price lock and the regular price when promo seats are gone", async () => {
    await openPayments();
    const locked = await createMember();
    const plan = await prisma.plan.findUniqueOrThrow({ where: { slug: MONTHLY.slug } });
    const pastOrder = await prisma.order.create({
      data: { orderNumber: "ORD-20260101-AAAAAA", userId: locked.id, planId: plan.id, amount: 790, status: "APPROVED", expiresAt: T0 },
    });
    await prisma.subscription.create({
      data: {
        userId: locked.id, planId: plan.id, orderId: pastOrder.id, status: "EXPIRED",
        currentPeriodStart: T0, currentPeriodEnd: T0, isPriceLocked: true, lockedPrice: 790,
      },
    });

    await createOrder(prisma, { userId: locked.id, planSlug: MONTHLY.slug, now: T0 });
    const lockedOrder = await prisma.order.findFirstOrThrow({ where: { userId: locked.id, status: "PENDING_PAYMENT" } });
    expect(Math.ceil(lockedOrder.amount.toNumber())).toBe(790);

    await prisma.plan.update({ where: { slug: MONTHLY.slug }, data: { promoEnrolledCount: MONTHLY.promoLimit } });
    const regular = await createMember();
    await createOrder(prisma, { userId: regular.id, planSlug: MONTHLY.slug, now: T0 });
    const regularOrder = await prisma.order.findFirstOrThrow({ where: { userId: regular.id } });
    expect(Math.ceil(regularOrder.amount.toNumber())).toBe(MONTHLY.originalPrice);
  });

  it("gives concurrent orders from different members distinct satang amounts", async () => {
    await openPayments();
    const members = await Promise.all(Array.from({ length: 10 }, () => createMember()));

    const results = await Promise.all(
      members.map((member) => createOrder(prisma, { userId: member.id, planSlug: MONTHLY.slug, now: T0, random: () => 0 })),
    );

    expect(results.every((result) => result.ok)).toBe(true);
    const amounts = (await prisma.order.findMany()).map((order) => order.amount.toNumber());
    expect(new Set(amounts).size).toBe(members.length);
  });

  it("refuses new orders instead of reusing an amount when every satang value is taken", async () => {
    await openPayments();
    const filler = await createMember();
    const plan = await prisma.plan.findUniqueOrThrow({ where: { slug: MONTHLY.slug } });
    await prisma.order.createMany({
      data: Array.from({ length: 99 }, (_, index) => ({
        orderNumber: `ORD-20261011-F${String(index).padStart(5, "0")}`,
        userId: filler.id,
        planId: plan.id,
        amount: (MONTHLY.price * 100 - (index + 1)) / 100,
        status: "SLIP_SUBMITTED" as const,
        expiresAt: T0,
      })),
    });
    const member = await createMember();

    expect(await createOrder(prisma, { userId: member.id, planSlug: MONTHLY.slug, now: T0 })).toEqual({ ok: false, code: "CHECKOUT_BUSY" });
  });

  it("refuses to create the order when the price changed after the member saw it", async () => {
    await openPayments();
    const member = await createMember();

    expect(await createOrder(prisma, { userId: member.id, planSlug: MONTHLY.slug, now: T0, expectedBasePrice: 500 })).toEqual({
      ok: false,
      code: "PRICE_CHANGED",
    });
    expect((await createOrder(prisma, { userId: member.id, planSlug: MONTHLY.slug, now: T0, expectedBasePrice: MONTHLY.price })).ok).toBe(true);
  });

  it("records terms acceptance, terms version, IP and the receiving account name with the order", async () => {
    await openPayments();
    const member = await createMember();

    const result = await createOrder(prisma, {
      userId: member.id,
      planSlug: MONTHLY.slug,
      now: T0,
      termsVersion: "2026-10-11",
      ipAddress: "203.0.113.7",
    });

    const order = await prisma.order.findUniqueOrThrow({ where: { id: result.ok ? result.orderId : "" }, include: { payment: true } });
    expect(order.termsAcceptedAt?.getTime()).toBe(T0.getTime());
    expect(order.termsVersion).toBe("2026-10-11");
    expect(order.createdIp).toBe("203.0.113.7");
    expect(order.payment?.promptpayAccountName).toBe("บัญชีทดสอบ");
  });

  it("does not allow the same bank transaction reference on two payments", async () => {
    await openPayments();
    const [alice, bob] = [await createMember(), await createMember()];
    const first = await createOrder(prisma, { userId: alice.id, planSlug: MONTHLY.slug, now: T0 });
    const second = await createOrder(prisma, { userId: bob.id, planSlug: MONTHLY.slug, now: T0 });
    await prisma.payment.update({ where: { orderId: first.ok ? first.orderId : "" }, data: { referenceNo: "BANKREF123" } });

    await expect(
      prisma.payment.update({ where: { orderId: second.ok ? second.orderId : "" }, data: { referenceNo: "BANKREF123" } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("refuses unknown and inactive plans", async () => {
    await openPayments();
    const member = await createMember();
    expect(await createOrder(prisma, { userId: member.id, planSlug: "nope", now: T0 })).toEqual({ ok: false, code: "PLAN_NOT_FOUND" });
    await prisma.plan.update({ where: { slug: MONTHLY.slug }, data: { isActive: false } });
    expect(await createOrder(prisma, { userId: member.id, planSlug: MONTHLY.slug, now: T0 })).toEqual({ ok: false, code: "PLAN_NOT_FOUND" });
  });
});

describe("Integration: slip upload and duplicate protection", () => {
  async function pendingOrder(now = T0) {
    const member = await createMember();
    const result = await createOrder(prisma, { userId: member.id, planSlug: MONTHLY.slug, now });
    if (!result.ok) throw new Error(result.code);
    return { member, orderId: result.orderId };
  }

  beforeEach(openPayments);

  it("stores the slip, records its hash and moves the order to SLIP_SUBMITTED", async () => {
    const { member, orderId } = await pendingOrder();
    const slip = fakeSlip();

    const result = await submitSlip(prisma, { userId: member.id, orderId, bytes: slip, now: at(5) });

    expect(result).toMatchObject({ ok: true });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { slipUploads: true } });
    expect(order.status).toBe("SLIP_SUBMITTED");
    expect(order.slipHash).toHaveLength(64);
    expect(order.slipUploadedAt?.getTime()).toBe(at(5).getTime());
    expect(order.slipUploads).toHaveLength(1);
    expect(order.slipUploads[0]).toMatchObject({ mimeType: "image/png", sizeBytes: slip.length, userId: member.id });
    expect(Buffer.from(order.slipUploads[0].data).equals(Buffer.from(slip))).toBe(true);
  });

  it("rejects a slip that was already used on another order", async () => {
    const first = await pendingOrder();
    const second = await pendingOrder();
    const slip = fakeSlip();
    await submitSlip(prisma, { userId: first.member.id, orderId: first.orderId, bytes: slip, now: at(1) });

    const result = await submitSlip(prisma, { userId: second.member.id, orderId: second.orderId, bytes: slip, now: at(2) });

    expect(result).toEqual({ ok: false, code: "DUPLICATE_SLIP" });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: second.orderId } });
    expect(order.status).toBe("PENDING_PAYMENT");
    expect(await prisma.slipUpload.count()).toBe(1);
  });

  it("never accepts a rejected slip again, but accepts a new slip after rejection", async () => {
    const { member, orderId } = await pendingOrder();
    const rejectedSlip = fakeSlip();
    await submitSlip(prisma, { userId: member.id, orderId, bytes: rejectedSlip, now: at(1) });
    await prisma.order.update({ where: { id: orderId }, data: { status: "REJECTED", rejectedAt: at(2), rejectionReason: "ยอดไม่ตรง" } });

    expect(await submitSlip(prisma, { userId: member.id, orderId, bytes: rejectedSlip, now: at(3) })).toEqual({ ok: false, code: "DUPLICATE_SLIP" });
    const retry = await submitSlip(prisma, { userId: member.id, orderId, bytes: fakeSlip(), now: at(4) });

    expect(retry).toMatchObject({ ok: true });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("SLIP_SUBMITTED");
    expect(order.rejectionReason).toBeNull();
    expect(await prisma.slipUpload.count({ where: { orderId } })).toBe(2);
  });

  it("lets only one of two concurrent uploads of the same slip succeed", async () => {
    const first = await pendingOrder();
    const second = await pendingOrder();
    const slip = fakeSlip();

    const results = await Promise.all([
      submitSlip(prisma, { userId: first.member.id, orderId: first.orderId, bytes: slip, now: at(1) }),
      submitSlip(prisma, { userId: second.member.id, orderId: second.orderId, bytes: slip, now: at(1) }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.code === "DUPLICATE_SLIP")).toHaveLength(1);
    expect(await prisma.slipUpload.count()).toBe(1);
  });

  it("does not accept slips for another member's order or after the order is submitted", async () => {
    const { member, orderId } = await pendingOrder();
    const stranger = await createMember();
    expect(await submitSlip(prisma, { userId: stranger.id, orderId, bytes: fakeSlip(), now: at(1) })).toEqual({ ok: false, code: "ORDER_NOT_FOUND" });

    await submitSlip(prisma, { userId: member.id, orderId, bytes: fakeSlip(), now: at(1) });
    expect(await submitSlip(prisma, { userId: member.id, orderId, bytes: fakeSlip(), now: at(2) })).toEqual({ ok: false, code: "NOT_ACCEPTING_SLIP" });
  });

  it("accepts slips during the grace period and expires the order after it", async () => {
    const graceEnd = PAYMENT_RULES.paymentWindowMinutes + PAYMENT_RULES.slipUploadGraceMinutes;
    const inGrace = await pendingOrder();
    expect((await submitSlip(prisma, { userId: inGrace.member.id, orderId: inGrace.orderId, bytes: fakeSlip(), now: at(graceEnd - 1) })).ok).toBe(true);

    const late = await pendingOrder();
    expect(await submitSlip(prisma, { userId: late.member.id, orderId: late.orderId, bytes: fakeSlip(), now: at(graceEnd + 1) })).toEqual({
      ok: false,
      code: "NOT_ACCEPTING_SLIP",
    });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: late.orderId } })).status).toBe("EXPIRED");
  });

  it("rejects invalid files before touching the database", async () => {
    const { member, orderId } = await pendingOrder();
    const pdf = Uint8Array.from(Buffer.from("%PDF-1.7"));
    expect(await submitSlip(prisma, { userId: member.id, orderId, bytes: pdf, now: at(1) })).toEqual({ ok: false, code: "UNSUPPORTED_TYPE" });
    expect(await prisma.slipUpload.count()).toBe(0);
  });
});

describe("Integration: QR safety when payment settings change", () => {
  it("shows the account name captured at order time even if the setting changes later", async () => {
    await openPayments();
    const member = await createMember();
    const created = await createOrder(prisma, { userId: member.id, planSlug: MONTHLY.slug, now: T0 });
    await prisma.systemSetting.update({ where: { id: SYSTEM_SETTING_ID }, data: { promptpayAccountName: "ชื่อใหม่" } });

    const view = await getOrderForUser(prisma, { userId: member.id, orderId: created.ok ? created.orderId : "", now: at(1) });

    expect(view?.promptpayAccountName).toBe("บัญชีทดสอบ");
    expect(view?.promptpayPayload).not.toBeNull();
    expect(view?.paymentSuspended).toBe(false);
  });

  it("hides the QR when payments are switched off or the PromptPay account changed", async () => {
    await openPayments();
    const member = await createMember();
    const created = await createOrder(prisma, { userId: member.id, planSlug: MONTHLY.slug, now: T0 });
    const orderId = created.ok ? created.orderId : "";

    await prisma.systemSetting.update({ where: { id: SYSTEM_SETTING_ID }, data: { paymentsEnabled: false } });
    const closed = await getOrderForUser(prisma, { userId: member.id, orderId, now: at(1) });
    expect(closed?.promptpayPayload).toBeNull();
    expect(closed?.paymentSuspended).toBe(true);

    await prisma.systemSetting.update({ where: { id: SYSTEM_SETTING_ID }, data: { paymentsEnabled: true, promptpayNumber: "0899999999" } });
    const changed = await getOrderForUser(prisma, { userId: member.id, orderId, now: at(1) });
    expect(changed?.promptpayPayload).toBeNull();
    expect(changed?.paymentSuspended).toBe(true);
  });
});

describe("Integration: admin notification tracking", () => {
  it("records when admins were notified about a submitted slip", async () => {
    await openPayments();
    const member = await createMember();
    const created = await createOrder(prisma, { userId: member.id, planSlug: MONTHLY.slug, now: T0 });
    const orderId = created.ok ? created.orderId : "";

    await markAdminNotified(prisma, { orderId, now: at(2) });

    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).adminNotifiedAt?.getTime()).toBe(at(2).getTime());
  });
});

describe("Integration: order view for members", () => {
  it("shows the order only to its owner and reports the current phase", async () => {
    await openPayments();
    const member = await createMember();
    const stranger = await createMember();
    const created = await createOrder(prisma, { userId: member.id, planSlug: MONTHLY.slug, now: T0 });
    const orderId = created.ok ? created.orderId : "";

    expect(await getOrderForUser(prisma, { userId: stranger.id, orderId, now: T0 })).toBeNull();
    expect((await getOrderForUser(prisma, { userId: member.id, orderId, now: at(1) }))?.phase).toBe("AWAITING_PAYMENT");
    expect((await getOrderForUser(prisma, { userId: member.id, orderId, now: at(PAYMENT_RULES.paymentWindowMinutes + 1) }))?.phase).toBe("SLIP_GRACE");

    const expired = await getOrderForUser(prisma, {
      userId: member.id,
      orderId,
      now: at(PAYMENT_RULES.paymentWindowMinutes + PAYMENT_RULES.slipUploadGraceMinutes + 1),
    });
    expect(expired?.phase).toBe("EXPIRED");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("EXPIRED");
  });
});
