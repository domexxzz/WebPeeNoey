import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { resolveAuthSecret } from "@/lib/auth-secret";
import { isValidIp } from "@/lib/request";
import { parsePage } from "@/lib/format";

describe("Phase 4: NEXTAUTH_SECRET is never a hardcoded fallback in production", () => {
  const strong = "x".repeat(32);

  it("returns the configured secret", () => {
    expect(resolveAuthSecret({ NODE_ENV: "production", NEXTAUTH_SECRET: strong })).toBe(strong);
  });

  it("throws in production when the secret is missing or too short", () => {
    expect(() => resolveAuthSecret({ NODE_ENV: "production" })).toThrow(/NEXTAUTH_SECRET/);
    expect(() => resolveAuthSecret({ NODE_ENV: "production", NEXTAUTH_SECRET: "short" })).toThrow(/32/);
  });

  it("allows a development-only fallback outside production", () => {
    expect(resolveAuthSecret({ NODE_ENV: "development" }).length).toBeGreaterThanOrEqual(32);
    expect(resolveAuthSecret({ NODE_ENV: "test" }).length).toBeGreaterThanOrEqual(32);
  });

  it("is used by both the auth config and the middleware (no other hardcoded secret)", () => {
    for (const file of ["src/lib/auth.ts", "src/middleware.ts"]) {
      const source = fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
      expect(source, file).toContain("getAuthSecret()");
      expect(source, file).not.toMatch(/development-secret/);
    }
  });
});

describe("Phase 4: every admin page re-checks the admin role from the database", () => {
  const adminDir = path.resolve(__dirname, "../src/app/(admin)/admin");
  const pages = (function collect(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? collect(path.join(dir, entry.name)) : entry.name === "page.tsx" ? [path.join(dir, entry.name)] : [],
    );
  })(adminDir);

  it.each(pages.map((file) => [path.relative(adminDir, file), file]))("%s calls requireAdminPage()", (_name, file) => {
    // layout ถูกข้ามได้เมื่อเปลี่ยนหน้าแบบ soft navigation — ทุกหน้าต้องตรวจเอง
    expect(fs.readFileSync(file, "utf8")).toMatch(/await requireAdminPage\(\)/);
  });

  it("finds all admin pages", () => {
    expect(pages.length).toBeGreaterThanOrEqual(8);
  });
});

describe("Phase 4: request hardening helpers", () => {
  it("accepts only syntactically valid IP addresses for audit evidence", () => {
    ["203.0.113.9", "::1", "2001:db8::1"].forEach((ip) => expect(isValidIp(ip), ip).toBe(true));
    ["", "not-an-ip", "999.1.1.1", "1.2.3.4<script>", "a".repeat(100)].forEach((ip) => expect(isValidIp(ip), ip).toBe(false));
  });

  it("clamps page numbers so huge or invalid values cannot crash pagination", () => {
    expect(parsePage("3")).toBe(3);
    ["", "abc", "-5", "0", "1e21", "Infinity", undefined].forEach((value) => expect(parsePage(value), String(value)).toBe(1));
    expect(parsePage("999999")).toBe(10_000);
  });
});
