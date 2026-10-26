import { describe, expect, it } from "vitest";
import {
  isKnownBrokerHost,
  maskAccountNumber,
  maskEmail,
  normalizeAccountNumber,
  normalizeBrokerEmail,
  normalizeBrokerLink,
  parseMinDepositThb,
} from "@/lib/broker-ib/validation";
import { computeBrokerIbAvailability, type BrokerIbSettingValues } from "@/lib/broker-ib/availability";
import { BROKER_IB_CONTENT, BROKER_IB_PLAN, BROKER_IB_RULES } from "@/config/broker-ib";
import { buildIbSettingsChangedMessage } from "@/lib/broker-ib/notification";
import { SITE_PLANS } from "@/config/plans";

describe("broker IB input validation", () => {
  it("normalizes MT4/MT5 logins to plain digits and rejects anything else", () => {
    expect(normalizeAccountNumber(" 12 345-678 ")).toBe("12345678");
    expect(normalizeAccountNumber("98765")).toBe("98765");
    // 0 นำหน้าไม่ทำให้กลายเป็นบัญชีใหม่
    expect(normalizeAccountNumber("0012345678")).toBe("12345678");
    expect(normalizeAccountNumber("00000")).toBeNull();
    for (const bad of ["", "abc123", "1234", "1234567890123", "１２３４５６７８", "12345678x"]) {
      expect(normalizeAccountNumber(bad)).toBeNull();
    }
  });

  it("normalizes the broker email and rejects malformed or oversized ones", () => {
    expect(normalizeBrokerEmail("  Trader@Example.COM ")).toBe("trader@example.com");
    expect(normalizeBrokerEmail("no-at-sign")).toBeNull();
    expect(normalizeBrokerEmail("a@b")).toBeNull();
    expect(normalizeBrokerEmail(`${"x".repeat(250)}@example.com`)).toBeNull();
  });

  it("accepts https partner links (any domain) and the empty string to clear", () => {
    expect(normalizeBrokerLink("")).toEqual({ ok: true, url: "" });
    expect(normalizeBrokerLink(" https://clicks.pipaffiliates.com/c?c=123&l=en ")).toEqual({
      ok: true,
      url: "https://clicks.pipaffiliates.com/c?c=123&l=en",
    });
    expect(normalizeBrokerLink("https://one.exnesstrack.org/a/abc123")).toMatchObject({ ok: true });
  });

  it("rejects links that are not plain https or that hide credentials", () => {
    for (const bad of [
      "http://xm.com/ref",
      "javascript:alert(1)",
      "data:text/html,hi",
      "https://user:pass@xm.com/ref",
      "https://xm.com@evil.example/ref",
      "not a url",
      `https://xm.com/${"a".repeat(500)}`,
    ]) {
      expect(normalizeBrokerLink(bad)).toEqual({ ok: false });
    }
  });

  it("recognizes the brokers' own and affiliate-tracking domains (used for warnings, not blocking)", () => {
    expect(isKnownBrokerHost("XM", "https://www.xmglobal.com/referral?token=1")).toBe(true);
    expect(isKnownBrokerHost("XM", "https://clicks.pipaffiliates.com/c?c=1")).toBe(true);
    expect(isKnownBrokerHost("EXNESS", "https://one.exnesstrack.org/a/abc")).toBe(true);
    expect(isKnownBrokerHost("XM", "https://xm.com.evil.example/ref")).toBe(false);
    expect(isKnownBrokerHost("XM", "https://evilxm.com/ref")).toBe(false);
    expect(isKnownBrokerHost("EXNESS", "https://www.xmglobal.com/ref")).toBe(false);
  });

  it("parses the minimum deposit in baht (blank = not set)", () => {
    expect(parseMinDepositThb("")).toEqual({ ok: true, value: null });
    expect(parseMinDepositThb(" 1000 ")).toEqual({ ok: true, value: 1000 });
    expect(parseMinDepositThb("1,500.50")).toEqual({ ok: true, value: 1500.5 });
    for (const bad of ["0", "-5", "99.999", "1e6", "abc", "1000000.01"]) {
      expect(parseMinDepositThb(bad)).toEqual({ ok: false });
    }
  });

  it("masks account numbers and emails for notifications (PDPA)", () => {
    expect(maskAccountNumber("12345678")).toBe("****5678");
    expect(maskAccountNumber("1234")).toBe("****");
    expect(maskEmail("trader@example.com")).toBe("t***@example.com");
  });
});

describe("broker IB availability", () => {
  const base: BrokerIbSettingValues = {
    ibClaimsEnabled: true,
    maintenanceMode: false,
    ibXmLink: "https://clicks.pipaffiliates.com/c?c=1",
    ibExnessLink: "https://one.exnesstrack.org/a/abc",
    ibMinDepositXmThb: 1000,
    ibMinDepositExnessThb: 1500,
    ibUsdThbRate: 33.5,
  };

  it("is closed when there is no setting row or the switch is off", () => {
    expect(computeBrokerIbAvailability(null)).toEqual({ open: false, reason: "DISABLED" });
    expect(computeBrokerIbAvailability({ ...base, ibClaimsEnabled: false })).toEqual({ open: false, reason: "DISABLED" });
  });

  it("is closed during maintenance", () => {
    expect(computeBrokerIbAvailability({ ...base, maintenanceMode: true })).toEqual({ open: false, reason: "MAINTENANCE" });
  });

  it("is not configured without an exchange rate or a usable link", () => {
    expect(computeBrokerIbAvailability({ ...base, ibUsdThbRate: null })).toEqual({ open: false, reason: "NOT_CONFIGURED" });
    expect(computeBrokerIbAvailability({ ...base, ibXmLink: "", ibExnessLink: "" })).toEqual({ open: false, reason: "NOT_CONFIGURED" });
  });

  it("offers each broker only when its own link is valid (a tampered value in the database is ignored)", () => {
    expect(computeBrokerIbAvailability(base)).toEqual({
      open: true,
      usdThbRate: 33.5,
      brokers: [
        { broker: "XM", label: "XM", link: "https://clicks.pipaffiliates.com/c?c=1", minDepositThb: 1000, minDepositUsd: 29.85 },
        { broker: "EXNESS", label: "Exness", link: "https://one.exnesstrack.org/a/abc", minDepositThb: 1500, minDepositUsd: 44.78 },
      ],
    });
    expect(computeBrokerIbAvailability({ ...base, ibExnessLink: "javascript:alert(1)" })).toMatchObject({
      open: true,
      brokers: [{ broker: "XM" }],
    });
    expect(computeBrokerIbAvailability({ ...base, ibXmLink: "http://xm.com", ibExnessLink: "" })).toEqual({ open: false, reason: "NOT_CONFIGURED" });
  });
});

describe("broker IB plan config", () => {
  /**
   * ข้อความขายบนหน้า /broker-ib เคยเขียน "30 วัน" และ "7 วันก่อนหมดอายุ" ไว้ตายตัว
   * พอเจ้าของเปลี่ยนนโยบายเป็น 7 วัน หน้าเว็บจึงสัญญากับลูกค้าคนละอย่างกับที่ระบบให้จริง (CLAUDE.md ข้อ 3)
   * ทุกจำนวนวันที่พูดถึงในคอนเทนต์ชุดนี้ต้องเป็นค่าที่ตั้งไว้จริงเท่านั้น
   */
  it("never promises a number of days that the system does not actually grant", () => {
    const allowed = new Set([BROKER_IB_PLAN.durationDays, BROKER_IB_RULES.renewalWindowDays]);
    const strings: string[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === "string") strings.push(value);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") Object.values(value).forEach(walk);
    };
    walk(BROKER_IB_CONTENT);

    expect(strings.length).toBeGreaterThan(5);
    for (const line of strings) {
      for (const match of line.matchAll(/(\d+)\s*วัน/g)) {
        expect(allowed, `"${match[0]}" ใน "${line.slice(0, 60)}…" ไม่ตรงกับค่าที่ตั้งไว้`).toContain(Number(match[1]));
      }
    }
  });

  it("is a short free plan outside the paid price list, with the entry plan's benefits minus the price lock", () => {
    expect(BROKER_IB_PLAN.durationDays).toBeGreaterThan(0);
    expect(BROKER_IB_PLAN.name).toContain(`${BROKER_IB_PLAN.durationDays} วัน`);
    expect(SITE_PLANS.some((plan) => plan.slug === BROKER_IB_PLAN.slug)).toBe(false);
    expect(BROKER_IB_PLAN.features.length).toBeGreaterThan(0);
    for (const feature of BROKER_IB_PLAN.features) expect(SITE_PLANS[0].features).toContain(feature);
    expect(BROKER_IB_PLAN.features.some((feature) => feature.includes("ล็อกราคา"))).toBe(false);
  });
});

describe("IB settings change alert", () => {
  const before = { ibClaimsEnabled: true, ibXmLink: "https://clicks.pipaffiliates.com/c?c=1", ibExnessLink: "", ibMinDepositXmThb: 1000, ibMinDepositExnessThb: null, ibUsdThbRate: 33.5 };

  it("lists only what changed, old → new, and flags a domain change", () => {
    const message = buildIbSettingsChangedMessage(before, { ...before, ibXmLink: "https://evil.example/ref?c=9" }, "admin-1");
    expect(message).toContain("ลิงก์ XM: https://clicks.pipaffiliates.com/c?c=1 → https://evil.example/ref?c=9");
    expect(message).toContain("⚠️ โดเมนลิงก์ XM เปลี่ยน: clicks.pipaffiliates.com → evil.example");
    expect(message).not.toContain("Exness");
    expect(message).not.toContain("ฝากขั้นต่ำ");
    expect(message).toContain("admin-1");
  });

  it("does not raise the domain flag when only the referral code changes on the same host", () => {
    const message = buildIbSettingsChangedMessage(before, { ...before, ibXmLink: "https://clicks.pipaffiliates.com/c?c=2" }, "admin-1");
    expect(message).toContain("ลิงก์ XM:");
    expect(message).not.toContain("⚠️");
  });
});
