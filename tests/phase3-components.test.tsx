import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PAYMENT_RULES } from "@/config/payment";
import { buildPromptPayPayload } from "@/lib/payments/promptpay";
import { PromptPayQr } from "@/components/checkout/promptpay-qr";
import { SlipUploadForm } from "@/components/checkout/slip-upload-form";
import { Countdown, remainingMs } from "@/components/checkout/countdown";
import { OrderStatusBadge } from "@/components/checkout/order-status-badge";

// react-dom ของ node_modules (18.3 stable) ไม่มี useFormState/useFormStatus แบบที่ Next.js ใช้ — จำลองไว้สำหรับ render
vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  useFormState: (action: unknown, initialState: unknown) => [initialState, action],
  useFormStatus: () => ({ pending: false }),
}));
vi.mock("@/app/(account)/checkout/actions", () => ({ submitSlipAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("Phase 3: PromptPay QR component", () => {
  it("renders an accessible inline SVG QR for the payload", async () => {
    const payload = buildPromptPayPayload("0812345678", 989.63);
    const html = renderToStaticMarkup(await PromptPayQr({ payload, label: "PromptPay QR ยอด 989.63 บาท" }));

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="PromptPay QR ยอด 989.63 บาท"');
    expect(html).toContain("<svg");
    expect(html).not.toContain("<script");
  });
});

describe("Phase 3: Slip upload form", () => {
  it("posts the order id with an image-only, required file input and states the size limit", () => {
    const html = renderToStaticMarkup(<SlipUploadForm orderId="order-123" />);

    expect(html).toContain('name="orderId" value="order-123"');
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(html).toMatch(/type="file"[^>]*required/);
    expect(html).toContain(`${PAYMENT_RULES.slipMaxSizeMb}MB`);
  });
});

describe("Phase 3: Countdown", () => {
  it("corrects for a client clock that runs ahead of or behind the server", () => {
    const deadline = 1_000_000;
    // นาฬิกาเครื่องผู้ใช้เร็วกว่า server 60 วินาที → offset -60s
    expect(remainingMs(deadline, deadline - 30_000 + 60_000, -60_000)).toBe(30_000);
    // นาฬิกาเครื่องผู้ใช้ช้ากว่า server 60 วินาที → offset +60s
    expect(remainingMs(deadline, deadline - 30_000 - 60_000, 60_000)).toBe(30_000);
  });

  it("renders a neutral placeholder on the server to avoid hydration mismatches", () => {
    const html = renderToStaticMarkup(<Countdown deadline="2026-10-11T03:30:00Z" serverNow="2026-10-11T03:00:00Z" />);
    expect(html).toContain('role="timer"');
    expect(html).toContain("--:--");
  });
});

describe("Phase 3: Order status badge", () => {
  it("shows the Thai label for the phase", () => {
    expect(renderToStaticMarkup(<OrderStatusBadge phase="SLIP_SUBMITTED" />)).toContain("รอตรวจสอบสลิป");
  });
});
