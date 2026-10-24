import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "crypto";
import { SITE_PLANS } from "@/config/plans";
import { seedDatabase, SYSTEM_SETTING_ID } from "@/lib/db/seed";
import { createOrder, submitSlip } from "@/lib/orders/checkout";
import { approveOrder, rejectOrder } from "@/lib/admin/order-review";
import { runSlipRecheck, SLIP_RECHECK_MAX_ATTEMPTS } from "@/lib/jobs/slip-recheck";
import type { SlipInspector } from "@/lib/orders/slip-inspection";
import type { SlipCheckResult } from "@/lib/payments/easyslip";
import type { SlipQrResult } from "@/lib/payments/slip-qr";
import { createTestPrisma, resetDatabase } from "./helpers";

const prisma = createTestPrisma();
const NOW = new Date("2026-10-24T03:00:00Z");
const LATER = new Date("2026-10-24T03:10:00Z");

function qr(payload: string): SlipQrResult {
  return { found: true, payload, reference: `REF${payload}`, integrity: "VALID", strategy: "native" };
}

function verified(transRef: string, amount = 990): SlipCheckResult {
  return { status: "VERIFIED", note: "ธนาคารยืนยันแล้ว", transRef, amount, slipDate: new Date("2026-10-24T03:05:00Z"), receiverName: "บัญชีทดสอบ" };
}

const PENDING: SlipCheckResult = { status: "PENDING", note: "ธนาคารกรุงเทพยังไม่อัปเดต" };

function inspector(qrResult: SlipQrResult, check: SlipCheckResult | ((input: unknown) => Promise<SlipCheckResult>)) {
  const checkFn = vi.fn(typeof check === "function" ? check : async () => check);
  const fake: SlipInspector = { readQr: async () => qrResult, check: checkFn, receiverAccounts: ["xxx-x-x1234-x"] };
  return { fake, checkFn };
}

const fakeJpeg = () => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from(randomBytes(32))]);

async function openOrder() {
  const user = await prisma.user.create({ data: { email: `m-${randomBytes(4).toString("hex")}@example.com`, role: "USER", passwordHash: "x" } });
  const created = await createOrder(prisma, { userId: user.id, planSlug: SITE_PLANS[0].slug, now: NOW });
  if (!created.ok) throw new Error(created.code);
  return { userId: user.id, orderId: created.orderId };
}

async function submitWith(order: { userId: string; orderId: string }, slipInspector: SlipInspector, now = NOW) {
  return submitSlip(prisma, { ...order, bytes: fakeJpeg(), now, inspector: slipInspector });
}

const okAlert = () => vi.fn().mockResolvedValue({ ok: true });

beforeEach(async () => {
  await resetDatabase(prisma);
  await seedDatabase(prisma, { adminEmail: "admin@example.com", adminPassword: "integration-test-password" });
  await prisma.systemSetting.update({
    where: { id: SYSTEM_SETTING_ID },
    data: { paymentsEnabled: true, promptpayNumber: "0812345678", promptpayAccountName: "บัญชีทดสอบ" },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integration: slip check on upload", () => {
  it("stores the QR and the bank-verified result on the upload, without approving the order", async () => {
    const order = await openOrder();
    const { fake } = inspector(qr("QR-A"), verified("TRANS-A"));

    const result = await submitWith(order, fake);

    expect(result).toMatchObject({ ok: true, check: { status: "VERIFIED" }, qrIntegrity: "VALID" });
    const upload = await prisma.slipUpload.findFirstOrThrow({ where: { orderId: order.orderId } });
    expect(upload).toMatchObject({ qrPayload: "QR-A", qrReference: "REFQR-A", qrIntegrity: "VALID", checkStatus: "VERIFIED", transRef: "TRANS-A", checkAttempts: 1, receiverName: "บัญชีทดสอบ" });
    expect(upload.slipAmount?.toNumber()).toBe(990);
    expect(upload.checkedAt).toEqual(NOW);
    // ไม่มีการอนุมัติอัตโนมัติ
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } })).status).toBe("SLIP_SUBMITTED");
  });

  it("passes the exact order amount, creation time and our receiver accounts to the bank check", async () => {
    const order = await openOrder();
    const { fake, checkFn } = inspector(qr("QR-B"), verified("TRANS-B"));

    await submitWith(order, fake);

    const saved = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect(checkFn).toHaveBeenCalledWith(
      expect.objectContaining({
        qrPayload: "QR-B",
        expectedAmount: saved.amount.toNumber(),
        orderCreatedAt: saved.createdAt,
        receiverIds: ["0812345678", "xxx-x-x1234-x"],
        receiverAccountName: "บัญชีทดสอบ",
      }),
    );
  });

  it("does not decode or bank-check slips for someone else's order", async () => {
    const order = await openOrder();
    const stranger = await openOrder();
    const readQr = vi.fn(async () => qr("QR-S"));
    const checkFn = vi.fn(async () => verified("TRANS-S"));

    const result = await submitSlip(prisma, { userId: stranger.userId, orderId: order.orderId, bytes: fakeJpeg(), now: NOW, inspector: { readQr, check: checkFn, receiverAccounts: [] } });

    expect(result).toEqual({ ok: false, code: "ORDER_NOT_FOUND" });
    expect(readQr).not.toHaveBeenCalled();
    expect(checkFn).not.toHaveBeenCalled();
  });

  it("lets a customer re-send a clearer photo of the same transfer to the same order after a rejection", async () => {
    const order = await openOrder();
    const other = await openOrder();
    await submitWith(order, inspector(qr("QR-BLUR"), verified("TRANS-BLUR")).fake);
    await prisma.order.update({ where: { id: order.orderId }, data: { status: "REJECTED" } });

    const again = await submitWith(order, inspector(qr("QR-BLUR"), verified("TRANS-BLUR")).fake, LATER);

    expect(again).toMatchObject({ ok: true, check: { status: "VERIFIED" } });
    const uploads = await prisma.slipUpload.findMany({ where: { orderId: order.orderId }, orderBy: { createdAt: "asc" } });
    expect(uploads.map((upload) => [upload.qrPayload, upload.transRef])).toEqual([
      [null, null],
      ["QR-BLUR", "TRANS-BLUR"],
    ]);
    // ข้ามออเดอร์ยังห้ามเหมือนเดิม
    expect(await submitWith(other, inspector(qr("QR-BLUR"), verified("TRANS-BLUR")).fake, LATER)).toEqual({ ok: false, code: "DUPLICATE_SLIP" });
  });

  it("rejects a re-photographed slip (new file, same QR) on another order before spending a bank check", async () => {
    const first = await openOrder();
    const second = await openOrder();
    const { fake, checkFn } = inspector(qr("QR-SAME"), verified("TRANS-1"));

    expect((await submitWith(first, fake)).ok).toBe(true);
    expect(await submitWith(second, fake)).toEqual({ ok: false, code: "DUPLICATE_SLIP" });
    expect(checkFn).toHaveBeenCalledTimes(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: second.orderId } })).status).toBe("PENDING_PAYMENT");
  });

  it("rejects a slip whose bank-confirmed transaction was already used, even with a different QR", async () => {
    const first = await openOrder();
    const second = await openOrder();

    expect((await submitWith(first, inspector(qr("QR-1"), verified("TRANS-REUSED")).fake)).ok).toBe(true);
    expect(await submitWith(second, inspector(qr("QR-2"), verified("TRANS-REUSED")).fake)).toEqual({ ok: false, code: "DUPLICATE_SLIP" });
    expect(await prisma.slipUpload.count()).toBe(1);
  });

  it("lets exactly one of two concurrent uploads with the same QR through", async () => {
    const first = await openOrder();
    const second = await openOrder();
    const { fake } = inspector(qr("QR-RACE"), { status: "DISABLED", note: "off" });

    const results = await Promise.all([submitWith(first, fake), submitWith(second, fake)]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, code: "DUPLICATE_SLIP" }]);
    expect(await prisma.slipUpload.count({ where: { qrPayload: "QR-RACE" } })).toBe(1);
  });

  it("accepts flagged slips for human review instead of rejecting them", async () => {
    const order = await openOrder();
    const mismatch: SlipCheckResult = { status: "AMOUNT_MISMATCH", note: "ยอดไม่ตรง", transRef: "TRANS-M", amount: 10 };

    expect(await submitWith(order, inspector(qr("QR-M"), mismatch).fake)).toMatchObject({ ok: true, check: { status: "AMOUNT_MISMATCH" } });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } })).status).toBe("SLIP_SUBMITTED");
  });

  it("still dedupes by file hash when the slip has no readable QR", async () => {
    const first = await openOrder();
    const second = await openOrder();
    const bytes = fakeJpeg();
    const noQr: SlipInspector = { readQr: async () => ({ found: false }), check: async () => ({ status: "DISABLED", note: "off" }), receiverAccounts: [] };

    expect((await submitSlip(prisma, { ...first, bytes, now: NOW, inspector: noQr })).ok).toBe(true);
    expect(await submitSlip(prisma, { ...second, bytes, now: NOW, inspector: noQr })).toEqual({ ok: false, code: "DUPLICATE_SLIP" });
    expect((await prisma.slipUpload.findFirstOrThrow()).qrIntegrity).toBeNull();
  });
});

describe("Integration: slip recheck job", () => {
  it("skips without a JobRun when nothing is pending", async () => {
    const order = await openOrder();
    await submitWith(order, inspector(qr("QR-V"), verified("TRANS-V")).fake);

    expect(await runSlipRecheck(prisma, { now: LATER, inspector: inspector(qr("x"), verified("x")).fake, alert: okAlert() })).toEqual({ ok: true, skipped: true });
    expect(await prisma.jobRun.count()).toBe(0);
  });

  it("re-checks pending slips, records the bank result and tells the admins", async () => {
    const order = await openOrder();
    await submitWith(order, inspector(qr("QR-P"), PENDING).fake);
    const alert = okAlert();
    const { fake, checkFn } = inspector(qr("QR-P"), verified("TRANS-P"));

    const outcome = await runSlipRecheck(prisma, { now: LATER, inspector: fake, alert });

    expect(outcome).toMatchObject({ ok: true, summary: { checked: 1, verified: 1, stillPending: 0 } });
    expect(checkFn).toHaveBeenCalledWith(expect.objectContaining({ qrPayload: "QR-P", now: LATER }));
    const upload = await prisma.slipUpload.findFirstOrThrow({ where: { orderId: order.orderId } });
    expect(upload).toMatchObject({ checkStatus: "VERIFIED", transRef: "TRANS-P", checkAttempts: 2, checkedAt: LATER });
    const saved = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect(alert).toHaveBeenCalledWith(expect.stringContaining(saved.orderNumber));
    expect(await prisma.jobRun.findFirstOrThrow({ where: { job: "slip-recheck" } })).toMatchObject({ status: "SUCCESS" });
    expect(saved.status).toBe("SLIP_SUBMITTED");
  });

  it("gives up after the maximum attempts and hands the slip to a human", async () => {
    const order = await openOrder();
    await submitWith(order, inspector(qr("QR-G"), PENDING).fake);
    await prisma.slipUpload.updateMany({ where: { orderId: order.orderId }, data: { checkAttempts: SLIP_RECHECK_MAX_ATTEMPTS - 1 } });

    const outcome = await runSlipRecheck(prisma, { now: LATER, inspector: inspector(qr("QR-G"), PENDING).fake, alert: okAlert() });

    expect(outcome).toMatchObject({ ok: true, summary: { gaveUp: 1 } });
    expect(await prisma.slipUpload.findFirstOrThrow({ where: { orderId: order.orderId } })).toMatchObject({ checkStatus: "ERROR", checkAttempts: SLIP_RECHECK_MAX_ATTEMPTS });
  });

  it("marks a slip as duplicate when the bank returns a transaction already used, and blocks its approval", async () => {
    const first = await openOrder();
    const second = await openOrder();
    await submitWith(first, inspector(qr("QR-X1"), verified("TRANS-X")).fake);
    await submitWith(second, inspector(qr("QR-X2"), PENDING).fake);

    const outcome = await runSlipRecheck(prisma, { now: LATER, inspector: inspector(qr("QR-X2"), verified("TRANS-X")).fake, alert: okAlert() });

    expect(outcome).toMatchObject({ ok: true, summary: { duplicates: 1 } });
    const upload = await prisma.slipUpload.findFirstOrThrow({ where: { orderId: second.orderId } });
    expect(upload).toMatchObject({ checkStatus: "DUPLICATE", transRef: null });
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    expect(await approveOrder(prisma, { orderId: second.orderId, actor: { id: admin.id, ipAddress: "203.0.113.9" }, referenceNo: "OTHERREF123", now: LATER })).toEqual({
      ok: false,
      code: "DUPLICATE_REFERENCE",
    });
  });

  it("stops rechecking a slip once a newer slip replaces it", async () => {
    const replaced = await openOrder();
    await submitWith(replaced, inspector(qr("QR-OLD"), PENDING).fake);
    await prisma.order.update({ where: { id: replaced.orderId }, data: { status: "REJECTED" } });
    await submitWith(replaced, inspector(qr("QR-NEW"), verified("TRANS-NEW")).fake, LATER);

    expect(await runSlipRecheck(prisma, { now: LATER, inspector: inspector(qr("x"), verified("x")).fake, alert: okAlert() })).toEqual({ ok: true, skipped: true });
    expect(await prisma.slipUpload.findFirstOrThrow({ where: { qrPayload: "QR-OLD" } })).toMatchObject({ checkStatus: "DISABLED" });
  });

  it("stops rechecking once an admin approves or rejects the order", async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    const actor = { id: admin.id, ipAddress: "203.0.113.9" };
    const approved = await openOrder();
    const rejected = await openOrder();
    await submitWith(approved, inspector(qr("QR-AP"), PENDING).fake);
    await submitWith(rejected, inspector(qr("QR-RJ"), PENDING).fake);

    expect((await approveOrder(prisma, { orderId: approved.orderId, actor, referenceNo: "BANKREF001", now: LATER })).ok).toBe(true);
    expect((await rejectOrder(prisma, { orderId: rejected.orderId, actor, reason: "สลิปไม่ชัด", now: LATER })).ok).toBe(true);

    const statuses = await prisma.slipUpload.findMany({ where: { qrPayload: { in: ["QR-AP", "QR-RJ"] } }, select: { checkStatus: true } });
    expect(statuses).toEqual([{ checkStatus: "DISABLED" }, { checkStatus: "DISABLED" }]);
    expect(await runSlipRecheck(prisma, { now: LATER, inspector: inspector(qr("x"), verified("x")).fake, alert: okAlert() })).toEqual({ ok: true, skipped: true });
  });
});
