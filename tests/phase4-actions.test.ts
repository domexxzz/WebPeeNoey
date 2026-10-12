import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { getAdminActor } from "@/lib/admin/guard";
import { approveOrder, refundOrder, rejectOrder } from "@/lib/admin/order-review";
import { revokeMemberAccess, setProvisioning } from "@/lib/admin/members";
import { updatePaymentSettings } from "@/lib/admin/settings";
import { sendReceiptEmail, sendSlipRejectedEmail } from "@/lib/email";
import { ADMIN_ERROR_MESSAGES } from "@/lib/admin/messages";
import { sendAdminTelegram } from "@/lib/notify/telegram";
import {
  approveOrderAction,
  refundOrderAction,
  rejectOrderAction,
  revokeMemberAction,
  setProvisioningAction,
  updateSettingsAction,
} from "@/app/(admin)/admin/actions";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(() => new Headers({ "x-forwarded-for": "203.0.113.9" })) }));
vi.mock("@/lib/admin/guard", () => ({ getAdminActor: vi.fn() }));
vi.mock("@/lib/admin/order-review", () => ({ approveOrder: vi.fn(), rejectOrder: vi.fn(), refundOrder: vi.fn() }));
vi.mock("@/lib/admin/members", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/members")>()),
  revokeMemberAccess: vi.fn(),
  setProvisioning: vi.fn(),
}));
vi.mock("@/lib/admin/settings", () => ({ updatePaymentSettings: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendReceiptEmail: vi.fn(), sendSlipRejectedEmail: vi.fn() }));
vi.mock("@/lib/notify/telegram", () => ({ sendAdminTelegram: vi.fn() }));

const idle = { status: "idle" } as const;
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.append(key, value));
  return data;
};
const actor = { id: "admin-1", ipAddress: "203.0.113.9" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" }, expires: "2099" } as never);
  vi.mocked(getAdminActor).mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  vi.mocked(sendReceiptEmail).mockResolvedValue(true);
  vi.mocked(sendSlipRejectedEmail).mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Phase 4: admin actions authorization", () => {
  it("refuses every action for users who are not admins in the database (even with an ADMIN session)", async () => {
    vi.mocked(getAdminActor).mockResolvedValue(null);
    const forbidden = { status: "error", message: ADMIN_ERROR_MESSAGES.FORBIDDEN };

    expect(await approveOrderAction(idle, form({ orderId: "o1", referenceNo: "REF1", confirmReceived: "on" }))).toEqual(forbidden);
    expect(await rejectOrderAction(idle, form({ orderId: "o1", reasonDetail: "x" }))).toEqual(forbidden);
    expect(await refundOrderAction(idle, form({ orderId: "o1" }))).toEqual(forbidden);
    expect(await updateSettingsAction(idle, form({}))).toEqual(forbidden);
    expect(await revokeMemberAction(idle, form({ userId: "u1" }))).toEqual(forbidden);
    expect(await setProvisioningAction(idle, form({}))).toEqual(forbidden);
    expect(approveOrder).not.toHaveBeenCalled();
    expect(updatePaymentSettings).not.toHaveBeenCalled();
  });
});

describe("Phase 4: approve / reject / refund actions", () => {
  it("requires confirming the money was received before approving", async () => {
    expect(await approveOrderAction(idle, form({ orderId: "o1", referenceNo: "REF1" }))).toEqual({ status: "error", message: ADMIN_ERROR_MESSAGES.CONFIRM_REQUIRED });
    expect(approveOrder).not.toHaveBeenCalled();
  });

  it("approves with the actor and IP, emails a receipt and refreshes admin pages", async () => {
    vi.mocked(approveOrder).mockResolvedValue({
      ok: true, orderNumber: "ORD-1", email: "c@example.com", planName: "แพ็กเกจ", amount: 989.5,
      periodStart: new Date("2026-10-12"), periodEnd: new Date("2026-11-11"), promoOversold: false,
    });

    const state = await approveOrderAction(idle, form({ orderId: "o1", referenceNo: "REF1", confirmReceived: "on" }));

    expect(state.status).toBe("success");
    expect(approveOrder).toHaveBeenCalledWith(expect.anything(), { orderId: "o1", actor, referenceNo: "REF1" });
    expect(sendReceiptEmail).toHaveBeenCalledWith("c@example.com", "ORD-1", "แพ็กเกจ", 989.5, new Date("2026-11-11"));
    expect(revalidatePath).toHaveBeenCalledWith("/admin/orders/o1");
  });

  it("warns the admin (screen + Telegram) when an approval oversells the promo seats", async () => {
    vi.mocked(approveOrder).mockResolvedValue({
      ok: true, orderNumber: "ORD-2", email: "c@example.com", planName: "แพ็กเกจ", amount: 989.5,
      periodStart: new Date("2026-10-12"), periodEnd: new Date("2026-11-11"), promoOversold: true,
    });

    const state = await approveOrderAction(idle, form({ orderId: "o2", referenceNo: "REF2", confirmReceived: "on" }));

    expect(state.status === "success" && state.message).toContain("ที่นั่งโปรโมชันเกิน");
    expect(sendAdminTelegram).toHaveBeenCalledWith(expect.stringContaining("ORD-2"));
  });

  it("reports duplicate bank references with a clear warning", async () => {
    vi.mocked(approveOrder).mockResolvedValue({ ok: false, code: "DUPLICATE_REFERENCE" });
    expect(await approveOrderAction(idle, form({ orderId: "o1", referenceNo: "REF1", confirmReceived: "on" }))).toEqual({
      status: "error",
      message: ADMIN_ERROR_MESSAGES.DUPLICATE_REFERENCE,
    });
  });

  it("combines the preset and detail into the rejection reason and emails the customer", async () => {
    vi.mocked(rejectOrder).mockResolvedValue({ ok: true, orderNumber: "ORD-1", email: "c@example.com", reason: "ยอดไม่ตรง — ขาด 10 บาท" });

    const state = await rejectOrderAction(idle, form({ orderId: "o1", reasonPreset: "ยอดไม่ตรง", reasonDetail: "ขาด 10 บาท" }));

    expect(state.status).toBe("success");
    expect(rejectOrder).toHaveBeenCalledWith(expect.anything(), { orderId: "o1", actor, reason: "ยอดไม่ตรง — ขาด 10 บาท" });
    expect(sendSlipRejectedEmail).toHaveBeenCalledWith("c@example.com", "ORD-1", "ยอดไม่ตรง — ขาด 10 บาท", expect.stringContaining("/checkout/order/o1"));
  });

  it("requires confirming the refund transfer and passes the amount as a number", async () => {
    expect((await refundOrderAction(idle, form({ orderId: "o1", amount: "100", reason: "x" }))).status).toBe("error");
    vi.mocked(refundOrder).mockResolvedValue({ ok: true, orderNumber: "ORD-1", email: "c@example.com", amount: 100, continuing: false });

    await refundOrderAction(idle, form({ orderId: "o1", amount: "100.50", reason: "ขอคืน", transferReference: "RF1", confirmRefund: "on" }));

    expect(refundOrder).toHaveBeenCalledWith(expect.anything(), { orderId: "o1", actor, amount: 100.5, reason: "ขอคืน", transferReference: "RF1" });
  });

  it("logs unexpected errors and shows a safe message instead of crashing", async () => {
    vi.mocked(approveOrder).mockRejectedValue(new Error("db exploded"));
    expect(await approveOrderAction(idle, form({ orderId: "o1", referenceNo: "REF1", confirmReceived: "on" }))).toEqual({
      status: "error",
      message: ADMIN_ERROR_MESSAGES.UNEXPECTED,
    });
    expect(console.error).toHaveBeenCalled();
    expect(sendAdminTelegram).toHaveBeenCalledWith(expect.stringContaining("UNEXPECTED"));
  });

  it("tells the admin when the customer email could not be sent", async () => {
    vi.mocked(rejectOrder).mockResolvedValue({ ok: true, orderNumber: "ORD-1", email: "c@example.com", reason: "สลิปไม่ชัด" });
    vi.mocked(sendSlipRejectedEmail).mockResolvedValue(false);
    const state = await rejectOrderAction(idle, form({ orderId: "o1", reasonPreset: "สลิปไม่ชัด" }));
    expect(state.status === "success" && state.message).toContain("ส่งอีเมลแจ้งลูกค้าไม่สำเร็จ");
  });
});

describe("Phase 4: settings, revoke and provisioning actions", () => {
  it("passes checkbox states as booleans to the settings service", async () => {
    vi.mocked(updatePaymentSettings).mockResolvedValue({ ok: true });
    await updateSettingsAction(idle, form({ paymentsEnabled: "on", promptpayNumber: "0899999999", promptpayAccountName: "ร้าน" }));
    expect(updatePaymentSettings).toHaveBeenCalledWith(expect.anything(), {
      actor, paymentsEnabled: true, maintenanceMode: false, promptpayNumber: "0899999999", promptpayAccountName: "ร้าน",
    });
    // เปลี่ยนบัญชีรับเงิน = เหตุการณ์เสี่ยงสูง ต้องแจ้งกลุ่มแอดมินเสมอ
    expect(sendAdminTelegram).toHaveBeenCalledWith(expect.stringContaining("0899999999"));
  });

  it("requires confirmation before revoking a member", async () => {
    expect((await revokeMemberAction(idle, form({ userId: "u1", reason: "แชร์บัญชี" }))).status).toBe("error");
    expect(revokeMemberAccess).not.toHaveBeenCalled();
  });

  it("rejects unknown provisioning channels and revalidates only server-derived admin paths", async () => {
    expect((await setProvisioningAction(idle, form({ channel: "__proto__", subscriptionId: "s1", granted: "true" }))).status).toBe("error");
    vi.mocked(setProvisioning).mockResolvedValue({ ok: true, orderId: "o9", userId: "u9" });
    await setProvisioningAction(idle, form({ channel: "discord", subscriptionId: "s1", granted: "true", revalidate: "https://evil.example" }));
    expect(setProvisioning).toHaveBeenCalledWith(expect.anything(), { subscriptionId: "s1", channel: "discord", granted: true, actor });
    expect(vi.mocked(revalidatePath).mock.calls.map(([path]) => path)).toEqual(["/admin/orders/o9", "/admin/members/u9"]);
  });
});
