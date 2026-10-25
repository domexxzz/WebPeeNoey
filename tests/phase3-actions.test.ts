import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/rate-limit";
import { createOrder, markAdminNotified, submitSlip } from "@/lib/orders/checkout";
import { sendAdminTelegram } from "@/lib/notify/telegram";
import { legalConfig } from "@/config/legal";
import { PAYMENT_RULES } from "@/config/payment";
import { CHECKOUT_ERROR_MESSAGES } from "@/lib/orders/messages";
import { createOrderAction, submitSlipAction } from "@/app/(account)/checkout/actions";

class RedirectSignal extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
// auditLog ต้องมีจริง: runAdminAction บันทึกทุกครั้งที่คำสั่งถูกปฏิเสธ
vi.mock("@/lib/prisma", () => ({ prisma: { auditLog: { create: vi.fn() } } }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectSignal(url);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(() => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/orders/checkout", () => ({ createOrder: vi.fn(), submitSlip: vi.fn(), markAdminNotified: vi.fn() }));
vi.mock("@/lib/notify/telegram", () => ({ sendAdminTelegram: vi.fn() }));

const session = { user: { id: "user-1", role: "USER" }, expires: "2099-01-01" };

function orderForm(fields: Record<string, string>): FormData {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  return form;
}

function slipForm(file?: File): FormData {
  const form = orderForm({ orderId: "order-1" });
  if (file) form.append("slip", file);
  return form;
}

const pngFile = () => new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "slip.png", { type: "image/png" });

async function redirectTarget(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("expected a redirect");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue(session as never);
  vi.mocked(checkRateLimit).mockResolvedValue({ success: true, remaining: 5, resetAt: new Date() });
  vi.mocked(sendAdminTelegram).mockResolvedValue({ ok: true });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Phase 3: createOrderAction", () => {
  const validForm = () => orderForm({ planSlug: "monthly", acceptTerms: "on", expectedBasePrice: "990" });

  it("sends guests to sign in and back to the same checkout page", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    expect(await redirectTarget(createOrderAction(validForm()))).toBe("/auth/signin?callbackUrl=%2Fcheckout%2Fmonthly");
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("requires accepting the terms", async () => {
    const form = orderForm({ planSlug: "monthly", expectedBasePrice: "990" });
    expect(await redirectTarget(createOrderAction(form))).toBe("/checkout/monthly?error=TERMS_REQUIRED");
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("applies a fail-closed rate limit", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ success: false, remaining: 0, resetAt: new Date() });
    expect(await redirectTarget(createOrderAction(validForm()))).toBe("/checkout/monthly?error=RATE_LIMITED");
    expect(checkRateLimit).toHaveBeenCalledWith("create-order:user-1", expect.any(Number), expect.any(Number), { failClosed: true });
  });

  it("creates the order with the shown price, terms version and client IP, then opens the payment page", async () => {
    vi.mocked(createOrder).mockResolvedValue({ ok: true, orderId: "order-9", reused: false });

    expect(await redirectTarget(createOrderAction(validForm()))).toBe("/checkout/order/order-9");
    expect(createOrder).toHaveBeenCalledWith(expect.anything(), {
      userId: "user-1",
      planSlug: "monthly",
      expectedBasePrice: 990,
      termsVersion: legalConfig.effectiveDate,
      ipAddress: "203.0.113.7",
    });
  });

  it("maps service errors to an error code on the checkout page", async () => {
    vi.mocked(createOrder).mockResolvedValue({ ok: false, code: "PRICE_CHANGED" });
    expect(await redirectTarget(createOrderAction(validForm()))).toBe("/checkout/monthly?error=PRICE_CHANGED");
  });

  it("logs and alerts admins on unexpected errors instead of failing silently", async () => {
    vi.mocked(createOrder).mockRejectedValue(new Error("db exploded"));

    expect(await redirectTarget(createOrderAction(validForm()))).toBe("/checkout/monthly?error=UNEXPECTED");
    expect(console.error).toHaveBeenCalled();
    expect(sendAdminTelegram).toHaveBeenCalledWith(expect.stringContaining("UNEXPECTED"));
  });
});

describe("Phase 3: submitSlipAction", () => {
  const idle = { status: "idle" } as const;

  it("checks the rate limit before anything else, even when no file is attached", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ success: false, remaining: 0, resetAt: new Date() });
    expect(await submitSlipAction(idle, slipForm())).toEqual({ status: "error", message: CHECKOUT_ERROR_MESSAGES.RATE_LIMITED });
    expect(checkRateLimit).toHaveBeenCalledWith("submit-slip:user-1", expect.any(Number), expect.any(Number), { failClosed: true });
  });

  it("rejects missing and oversized files before calling the service", async () => {
    expect(await submitSlipAction(idle, slipForm())).toEqual({ status: "error", message: CHECKOUT_ERROR_MESSAGES.NO_FILE });
    const big = new File([new Uint8Array(PAYMENT_RULES.slipMaxSizeMb * 1024 * 1024 + 1)], "big.png");
    expect(await submitSlipAction(idle, slipForm(big))).toEqual({ status: "error", message: CHECKOUT_ERROR_MESSAGES.FILE_TOO_LARGE });
    expect(submitSlip).not.toHaveBeenCalled();
  });

  it("maps service errors to Thai messages", async () => {
    vi.mocked(submitSlip).mockResolvedValue({ ok: false, code: "DUPLICATE_SLIP" });
    expect(await submitSlipAction(idle, slipForm(pngFile()))).toEqual({ status: "error", message: CHECKOUT_ERROR_MESSAGES.DUPLICATE_SLIP });
  });

  const accepted = {
    ok: true as const,
    orderId: "order-1",
    orderNumber: "ORD-1",
    amount: 989.5,
    planName: "แพ็กเกจ",
    uploadId: "up-1",
    check: { status: "VERIFIED" as const, note: "ธนาคารยืนยันแล้ว" },
    qrIntegrity: "VALID" as const,
  };

  it("notifies admins, records the notification and refreshes the pages on success", async () => {
    vi.mocked(submitSlip).mockResolvedValue(accepted);

    const state = await submitSlipAction(idle, slipForm(pngFile()));

    expect(state.status).toBe("success");
    expect(sendAdminTelegram).toHaveBeenCalledWith(expect.stringContaining("ORD-1"));
    expect(sendAdminTelegram).toHaveBeenCalledWith(expect.stringContaining("ธนาคารยืนยันแล้ว"));
    expect(markAdminNotified).toHaveBeenCalledWith(expect.anything(), { orderId: "order-1" });
    expect(revalidatePath).toHaveBeenCalledWith("/checkout/order/order-1");
  });

  it("raises a separate alert when the slip checker itself is broken (bad token / quota)", async () => {
    vi.mocked(submitSlip).mockResolvedValue({ ...accepted, check: { status: "ERROR", note: "token ผิด", alertAdmins: true } });

    expect((await submitSlipAction(idle, slipForm(pngFile()))).status).toBe("success");
    expect(sendAdminTelegram).toHaveBeenCalledWith(expect.stringContaining("🚨 ระบบตรวจสลิปอัตโนมัติใช้งานไม่ได้"));
    expect(sendAdminTelegram).toHaveBeenCalledWith(expect.stringContaining("ORD-1"));
  });

  it("keeps the slip accepted when Telegram fails, leaving it unmarked for a retry", async () => {
    vi.mocked(submitSlip).mockResolvedValue(accepted);
    vi.mocked(sendAdminTelegram).mockResolvedValue({ ok: false, reason: "NOT_CONFIGURED" });

    expect((await submitSlipAction(idle, slipForm(pngFile()))).status).toBe("success");
    expect(markAdminNotified).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("still reports success when refreshing the page fails after the slip was saved", async () => {
    vi.mocked(submitSlip).mockResolvedValue(accepted);
    vi.mocked(revalidatePath).mockImplementation(() => {
      throw new Error("cache down");
    });

    expect((await submitSlipAction(idle, slipForm(pngFile()))).status).toBe("success");
    expect(console.error).toHaveBeenCalled();
  });

  it("logs and alerts admins when the slip service throws", async () => {
    vi.mocked(submitSlip).mockRejectedValue(new Error("db exploded"));

    expect(await submitSlipAction(idle, slipForm(pngFile()))).toEqual({ status: "error", message: CHECKOUT_ERROR_MESSAGES.UNEXPECTED });
    expect(sendAdminTelegram).toHaveBeenCalledWith(expect.stringContaining("UNEXPECTED"));
  });
});
