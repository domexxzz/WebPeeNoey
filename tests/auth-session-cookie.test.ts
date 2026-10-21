import { describe, expect, it } from "vitest";
import { usesSecureSessionCookie } from "@/lib/auth-cookie";

describe("Middleware reads the same session cookie NextAuth sets (secure on HTTPS)", () => {
  it("uses the __Secure- cookie when NEXTAUTH_URL is https, on any host (not only Vercel)", () => {
    expect(usesSecureSessionCookie(new Headers(), "http://localhost:10000/admin", { NEXTAUTH_URL: "https://goldhybridshot.onrender.com" })).toBe(true);
  });

  it("uses the __Secure- cookie behind a TLS-terminating proxy even when NEXTAUTH_URL is not visible", () => {
    const headers = new Headers({ "x-forwarded-proto": "https" });
    expect(usesSecureSessionCookie(headers, "http://localhost:10000/admin", {})).toBe(true);
  });

  it("uses the plain cookie for local http development", () => {
    expect(usesSecureSessionCookie(new Headers(), "http://localhost:3000/admin", { NEXTAUTH_URL: "http://localhost:3000" })).toBe(false);
    expect(usesSecureSessionCookie(new Headers(), "http://localhost:3000/admin", {})).toBe(false);
  });

  it("uses the __Secure- cookie when the request itself is https", () => {
    expect(usesSecureSessionCookie(new Headers(), "https://goldhybridshot.onrender.com/admin", {})).toBe(true);
  });
});
