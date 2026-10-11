import { describe, it, expect, vi } from "vitest";
import { buildPromptPayPayload, normalizePromptPayTarget } from "@/lib/payments/promptpay";
import { applySatangDiscount, pickSatangDiscount, quotePlanPrice } from "@/lib/payments/pricing";
import { detectImageMime, validateSlipFile } from "@/lib/payments/slip";
import { safeCallbackUrl } from "@/lib/safe-redirect";
import { sendAdminTelegram } from "@/lib/notify/telegram";
import { generateOrderNumber } from "@/lib/security";
import { CHECKOUT_ERROR_MESSAGES, ORDER_PHASE_LABELS, checkoutErrorMessage } from "@/lib/orders/messages";
import { acceptsSlip, computeOrderPhase, slipDeadline } from "@/lib/orders/phase";
import { formatRemaining } from "@/components/checkout/countdown";
import { buildSlipResponseHeaders } from "@/lib/orders/slip-headers";
import { PAYMENT_RULES } from "@/config/payment";
import { SITE_PLANS } from "@/config/plans";

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) ตามมาตรฐาน EMVCo — เขียนแยกจากไลบรารีเพื่อตรวจไขว้ */
function crc16(text: string): string {
  let crc = 0xffff;
  const bytes = Buffer.from(text, "ascii");
  for (let index = 0; index < bytes.length; index++) {
    crc ^= bytes[index] << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56]);

describe("Phase 3: PromptPay target validation", () => {
  it("accepts Thai mobile numbers, national/tax IDs and e-wallet IDs after stripping separators", () => {
    expect(normalizePromptPayTarget("081-234-5678")).toEqual({ ok: true, target: "0812345678", type: "PHONE" });
    expect(normalizePromptPayTarget("1 2345 67890 12 3")).toEqual({ ok: true, target: "1234567890123", type: "NATIONAL_ID" });
    expect(normalizePromptPayTarget("123456789012345")).toEqual({ ok: true, target: "123456789012345", type: "EWALLET" });
  });

  it("rejects empty, malformed and landline-length values", () => {
    ["", "   ", "abc", "12345", "1812345678", "02123456", "08123456789"].forEach((value) =>
      expect(normalizePromptPayTarget(value).ok, value).toBe(false),
    );
  });
});

describe("Phase 3: PromptPay EMVCo payload", () => {
  it("builds a dynamic QR payload with the exact amount, THB currency and a valid CRC", () => {
    const payload = buildPromptPayPayload("0812345678", 989.63);
    expect(payload.startsWith("000201010212")).toBe(true); // dynamic QR (มียอดเงิน)
    expect(payload).toContain("A000000677010111"); // PromptPay AID
    expect(payload).toContain("0066812345678"); // เบอร์โทรแปลงเป็นรูปแบบสากล
    expect(payload).toContain("5303764"); // สกุลเงินบาท
    expect(payload).toContain("5406989.63"); // ยอดเงิน 2 ตำแหน่ง
    expect(payload).toContain("5802TH");
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });

  it("builds payloads for every real plan price and satang discount (floating point safe)", () => {
    const prices = Array.from(new Set(SITE_PLANS.flatMap((plan) => [plan.price, plan.originalPrice])));
    for (const price of prices) {
      for (let satang = PAYMENT_RULES.satangDiscountRange.min; satang <= PAYMENT_RULES.satangDiscountRange.max; satang++) {
        const amount = applySatangDiscount(price, satang);
        expect(() => buildPromptPayPayload("0812345678", amount), `${price} - ${satang} satang`).not.toThrow();
        expect(buildPromptPayPayload("0812345678", amount)).toContain(amount.toFixed(2));
      }
    }
  });

  it("refuses invalid targets and amounts instead of producing an unpayable QR", () => {
    expect(() => buildPromptPayPayload("12345", 100)).toThrow(/PromptPay/);
    expect(() => buildPromptPayPayload("0812345678", 0)).toThrow(/amount/i);
    expect(() => buildPromptPayPayload("0812345678", 10.005)).toThrow(/amount/i);
  });
});

describe("Phase 3: Pricing", () => {
  const plan = { price: 990, originalPrice: 1490, isPromo: true, promoLimit: 300, promoEnrolledCount: 0 };

  it("uses the locked price for members who own a price lock", () => {
    expect(quotePlanPrice(plan, 790)).toEqual({ basePrice: 790, reason: "LOCKED" });
  });

  it("uses the promo price while promo seats remain", () => {
    expect(quotePlanPrice({ ...plan, promoEnrolledCount: 299 }, null)).toEqual({ basePrice: 990, reason: "PROMO" });
  });

  it("falls back to the regular price once promo seats run out", () => {
    expect(quotePlanPrice({ ...plan, promoEnrolledCount: 300 }, null)).toEqual({ basePrice: 1490, reason: "REGULAR" });
    expect(quotePlanPrice({ ...plan, isPromo: false }, null)).toEqual({ basePrice: 1490, reason: "REGULAR" });
    expect(quotePlanPrice({ ...plan, isPromo: false, originalPrice: null }, null)).toEqual({ basePrice: 990, reason: "REGULAR" });
  });

  it("subtracts the satang discount so customers never pay above the listed price", () => {
    expect(applySatangDiscount(990, 37)).toBe(989.63);
    expect(applySatangDiscount(2490, 1)).toBe(2489.99);
    expect(applySatangDiscount(7990, 99)).toBe(7989.01);
  });

  it("picks a satang discount that no other open order with the same price is using", () => {
    const taken = new Set(Array.from({ length: 98 }, (_, index) => index + 1)); // 1..98 ถูกใช้แล้ว
    expect(pickSatangDiscount(taken, () => 0)).toBe(99);
    const value = pickSatangDiscount(new Set(), () => 0.5);
    expect(value).toBeGreaterThanOrEqual(PAYMENT_RULES.satangDiscountRange.min);
    expect(value).toBeLessThanOrEqual(PAYMENT_RULES.satangDiscountRange.max);
  });

  it("returns null instead of reusing an amount when every value is taken", () => {
    const allTaken = new Set(Array.from({ length: 99 }, (_, index) => index + 1));
    expect(pickSatangDiscount(allTaken, () => 0)).toBeNull();
  });
});

describe("Phase 3: Slip file validation", () => {
  it("detects JPEG, PNG and WebP by magic bytes", () => {
    expect(detectImageMime(JPEG)).toBe("image/jpeg");
    expect(detectImageMime(PNG)).toBe("image/png");
    expect(detectImageMime(WEBP)).toBe("image/webp");
  });

  it("rejects files whose content is not an allowed image even if renamed", () => {
    const pdf = Buffer.from("%PDF-1.7 fake slip");
    const svg = Buffer.from("<svg onload=alert(1)>");
    expect(detectImageMime(pdf)).toBeNull();
    expect(validateSlipFile(svg)).toEqual({ ok: false, code: "UNSUPPORTED_TYPE" });
  });

  it("rejects empty files and files over the size limit", () => {
    expect(validateSlipFile(new Uint8Array())).toEqual({ ok: false, code: "EMPTY_FILE" });
    const tooBig = new Uint8Array(PAYMENT_RULES.slipMaxSizeMb * 1024 * 1024 + 1);
    tooBig.set(JPEG);
    expect(validateSlipFile(tooBig)).toEqual({ ok: false, code: "FILE_TOO_LARGE" });
  });

  it("accepts a valid image and reports its real MIME type", () => {
    expect(validateSlipFile(PNG)).toEqual({ ok: true, mimeType: "image/png" });
  });
});

describe("Phase 3: Safe callback URLs (open redirect protection)", () => {
  it("keeps same-site relative paths with query and hash", () => {
    expect(safeCallbackUrl("/checkout/monthly")).toBe("/checkout/monthly");
    expect(safeCallbackUrl("/account?tab=orders#latest")).toBe("/account?tab=orders#latest");
  });

  it("falls back for external, protocol-relative, backslash and script URLs", () => {
    ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "checkout", "", null, undefined].forEach(
      (value) => expect(safeCallbackUrl(value), String(value)).toBe("/account"),
    );
    expect(safeCallbackUrl("https://evil.example", "/")).toBe("/");
  });

  it("blocks dot-segment tricks that normalize into a protocol-relative URL", () => {
    ["/.//evil.com", "/..//evil.com", "/a/..//evil.com", "/%2e//evil.com", "/%2E%2E//evil.com", "/.\\/evil.com"].forEach((value) =>
      expect(safeCallbackUrl(value), value).toBe("/account"),
    );
    expect(safeCallbackUrl("/checkout/./monthly")).toBe("/checkout/monthly");
  });
});

describe("Phase 3: Admin Telegram notifications", () => {
  it("does not call Telegram and reports NOT_CONFIGURED when credentials are missing", async () => {
    const fetchImpl = vi.fn();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await sendAdminTelegram("hi", { env: {}, fetchImpl });
    expect(result).toEqual({ ok: false, reason: "NOT_CONFIGURED" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalled(); // ห้ามล้มเงียบ (CLAUDE.md ข้อ 5)
    errorLog.mockRestore();
  });

  it("posts plain text to the admin chat without parse mode", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const env = { TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_ADMIN_CHAT_ID: "-100" };
    const result = await sendAdminTelegram("สลิปใหม่ <b>x</b>", { env, fetchImpl });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
    expect(JSON.parse(init.body)).toEqual({ chat_id: "-100", text: "สลิปใหม่ <b>x</b>", disable_web_page_preview: true });
  });

  it("reports HTTP and network failures and logs them", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const env = { TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_ADMIN_CHAT_ID: "-100" };
    const httpFail = vi.fn().mockResolvedValue(new Response("bad", { status: 400 }));
    expect(await sendAdminTelegram("x", { env, fetchImpl: httpFail })).toEqual({ ok: false, reason: "HTTP_ERROR" });
    const networkFail = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await sendAdminTelegram("x", { env, fetchImpl: networkFail })).toEqual({ ok: false, reason: "NETWORK_ERROR" });
    expect(errorLog).toHaveBeenCalledTimes(2);
    errorLog.mockRestore();
  });
});

describe("Phase 3: Checkout messages and countdown", () => {
  it("maps known error codes to Thai messages and unknown codes to a generic message", () => {
    expect(checkoutErrorMessage("DUPLICATE_SLIP")).toBe(CHECKOUT_ERROR_MESSAGES.DUPLICATE_SLIP);
    expect(checkoutErrorMessage("<script>")).toBe(CHECKOUT_ERROR_MESSAGES.UNEXPECTED);
    expect(checkoutErrorMessage(undefined)).toBeNull();
    // ชื่อ property ของ Object.prototype ต้องไม่หลุดเป็นค่าที่ render ไม่ได้
    ["__proto__", "constructor", "toString", "hasOwnProperty"].forEach((code) =>
      expect(checkoutErrorMessage(code), code).toBe(CHECKOUT_ERROR_MESSAGES.UNEXPECTED),
    );
    expect(CHECKOUT_ERROR_MESSAGES.FILE_TOO_LARGE).toContain(`${PAYMENT_RULES.slipMaxSizeMb}MB`);
  });

  it("has a label for every order phase", () => {
    const phases = ["AWAITING_PAYMENT", "SLIP_GRACE", "SLIP_SUBMITTED", "REJECTED", "APPROVED", "EXPIRED", "REFUNDED"] as const;
    phases.forEach((phase) => expect(ORDER_PHASE_LABELS[phase].label.length).toBeGreaterThan(0));
  });

  it("formats the remaining time as mm:ss and never goes negative", () => {
    expect(formatRemaining(30 * 60 * 1000)).toBe("30:00");
    expect(formatRemaining(61_500)).toBe("01:02");
    expect(formatRemaining(-5000)).toBe("00:00");
  });

  it("computes order phases from status and time, including the slip grace period", () => {
    const expiresAt = new Date("2026-10-11T03:30:00Z");
    const pending = { status: "PENDING_PAYMENT" as const, expiresAt };
    expect(computeOrderPhase(pending, new Date("2026-10-11T03:29:59Z"))).toBe("AWAITING_PAYMENT");
    expect(computeOrderPhase(pending, expiresAt)).toBe("SLIP_GRACE");
    expect(computeOrderPhase(pending, slipDeadline(expiresAt))).toBe("EXPIRED");
    expect(computeOrderPhase({ status: "REJECTED", expiresAt }, new Date("2030-01-01"))).toBe("REJECTED");
    expect(acceptsSlip("REJECTED")).toBe(true);
    expect(acceptsSlip("SLIP_SUBMITTED")).toBe(false);
  });
});

describe("Phase 3: Slip response headers", () => {
  it("serves slips inline with a locked-down CSP, nosniff and no caching", () => {
    const headers = buildSlipResponseHeaders({ id: "abc123", mimeType: "image/png", sizeBytes: 2048 });
    expect(headers).toEqual({
      "Content-Type": "image/png",
      "Content-Length": "2048",
      "Content-Disposition": 'inline; filename="slip-abc123.png"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
  });

  it("uses the right file extension for each allowed type", () => {
    expect(buildSlipResponseHeaders({ id: "a", mimeType: "image/jpeg", sizeBytes: 1 })["Content-Disposition"]).toContain(".jpg");
    expect(buildSlipResponseHeaders({ id: "a", mimeType: "image/webp", sizeBytes: 1 })["Content-Disposition"]).toContain(".webp");
  });
});

describe("Phase 3: Order numbers", () => {
  it("uses the Bangkok date and a 6-character random suffix", () => {
    const orderNumber = generateOrderNumber(new Date("2026-10-11T18:30:00Z")); // 01:30 วันที่ 12 ตามเวลาไทย
    expect(orderNumber).toMatch(/^ORD-20261012-[A-F0-9]{6}$/);
  });
});
