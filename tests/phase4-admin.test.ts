import { describe, expect, it } from "vitest";
import { buildAdminCsp, generateNonce } from "@/lib/csp";
import { ADMIN_ERROR_MESSAGES } from "@/lib/admin/messages";
import { normalizeBankReference } from "@/lib/admin/order-review";
import { parseAdminOrderTab } from "@/lib/admin/orders-query";
import { escapeHtml } from "@/lib/email";

describe("Phase 4: strict CSP for /admin", () => {
  it("allows scripts only with the per-request nonce and blocks framing, plugins and foreign forms", () => {
    const csp = buildAdminCsp("abc123", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("adds unsafe-eval only in development for React Refresh", () => {
    expect(buildAdminCsp("n", true)).toContain("'unsafe-eval'");
  });

  it("generates a different base64 nonce per request", () => {
    const [first, second] = [generateNonce(), generateNonce()];
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9+/=]{16,}$/);
  });
});

describe("Phase 4: admin helpers", () => {
  it("normalizes bank references so the same reference written differently is detected as a duplicate", () => {
    expect(normalizeBankReference(" ref 123-abc ")).toBe("REF123ABC");
    expect(normalizeBankReference("same ref 1")).toBe(normalizeBankReference("SAME-REF-1"));
  });

  it("falls back to the review tab for unknown or prototype tab names", () => {
    expect(parseAdminOrderTab("approved")).toBe("approved");
    ["__proto__", "constructor", "nope", undefined].forEach((value) => expect(parseAdminOrderTab(value)).toBe("review"));
  });

  it("has a Thai message for every admin error code", () => {
    Object.values(ADMIN_ERROR_MESSAGES).forEach((message) => expect(message.length).toBeGreaterThan(5));
  });

  it("escapes user-controlled text before it goes into email HTML", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">'&`)).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&amp;");
  });
});
