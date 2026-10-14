import { describe, expect, it } from "vitest";
import {
  isKnownBrokerHost,
  maskAccountNumber,
  maskEmail,
  normalizeAccountNumber,
  normalizeBrokerEmail,
  normalizeBrokerLink,
  parseMinDepositUsd,
} from "@/lib/broker-ib/validation";
import { computeBrokerIbAvailability, type BrokerIbSettingValues } from "@/lib/broker-ib/availability";
import { BROKER_IB_PLAN } from "@/config/broker-ib";
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

  it("parses the minimum deposit in USD (blank = not set)", () => {
    expect(parseMinDepositUsd("")).toEqual({ ok: true, value: null });
    expect(parseMinDepositUsd(" 100 ")).toEqual({ ok: true, value: 100 });
    expect(parseMinDepositUsd("49.50")).toEqual({ ok: true, value: 49.5 });
    for (const bad of ["0", "-5", "99.999", "1e6", "abc", "100000.01"]) {
      expect(parseMinDepositUsd(bad)).toEqual({ ok: false });
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
    ibMinDepositUsd: 100,
  };

  it("is closed when there is no setting row or the switch is off", () => {
    expect(computeBrokerIbAvailability(null)).toEqual({ open: false, reason: "DISABLED" });
    expect(computeBrokerIbAvailability({ ...base, ibClaimsEnabled: false })).toEqual({ open: false, reason: "DISABLED" });
  });

  it("is closed during maintenance", () => {
    expect(computeBrokerIbAvailability({ ...base, maintenanceMode: true })).toEqual({ open: false, reason: "MAINTENANCE" });
  });

  it("is not configured without a minimum deposit or a usable link", () => {
    expect(computeBrokerIbAvailability({ ...base, ibMinDepositUsd: null })).toEqual({ open: false, reason: "NOT_CONFIGURED" });
    expect(computeBrokerIbAvailability({ ...base, ibXmLink: "", ibExnessLink: "" })).toEqual({ open: false, reason: "NOT_CONFIGURED" });
  });

  it("offers each broker only when its own link is valid (a tampered value in the database is ignored)", () => {
    expect(computeBrokerIbAvailability(base)).toEqual({
      open: true,
      minDepositUsd: 100,
      brokers: [
        { broker: "XM", label: "XM", link: "https://clicks.pipaffiliates.com/c?c=1" },
        { broker: "EXNESS", label: "Exness", link: "https://one.exnesstrack.org/a/abc" },
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
  it("is a 30-day plan outside the paid price list, with the entry plan's benefits minus the price lock", () => {
    expect(BROKER_IB_PLAN.durationDays).toBe(30);
    expect(SITE_PLANS.some((plan) => plan.slug === BROKER_IB_PLAN.slug)).toBe(false);
    expect(BROKER_IB_PLAN.features.length).toBeGreaterThan(0);
    for (const feature of BROKER_IB_PLAN.features) expect(SITE_PLANS[0].features).toContain(feature);
    expect(BROKER_IB_PLAN.features.some((feature) => feature.includes("ล็อกราคา"))).toBe(false);
  });
});

describe("IB settings change alert", () => {
  const before = { ibClaimsEnabled: true, ibXmLink: "https://clicks.pipaffiliates.com/c?c=1", ibExnessLink: "", ibMinDepositUsd: 100 };

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
