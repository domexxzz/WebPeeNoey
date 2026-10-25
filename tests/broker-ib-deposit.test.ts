import { describe, expect, it } from "vitest";
import { BROKER_IB_RULES } from "@/config/broker-ib";
import { convertThbToUsd, meetsMinimumDeposit, minimumForBroker } from "@/lib/broker-ib/deposit";
import { parseMinDepositThb, parseUsdThbRate } from "@/lib/broker-ib/validation";
import { computeBrokerIbAvailability } from "@/lib/broker-ib/availability";

const SETTING = {
  ibClaimsEnabled: true,
  maintenanceMode: false,
  ibXmLink: "https://clicks.pipaffiliates.com/c?c=1263598&l=th&p=1",
  ibExnessLink: "https://one.exnessonelink.com/a/00awo0516g",
  ibMinDepositXmThb: 1000,
  ibMinDepositExnessThb: 1500,
  ibUsdThbRate: 33.5,
};

describe("Converting the baht minimum to the USD figure the broker reports show", () => {
  it("divides by the stored rate and rounds to cents", () => {
    expect(convertThbToUsd(1000, 33.5)).toBe(29.85);
    expect(convertThbToUsd(1500, 33.5)).toBe(44.78);
    expect(convertThbToUsd(1000, 32)).toBe(31.25);
  });

  it("refuses a rate that is zero or missing rather than dividing by it", () => {
    expect(convertThbToUsd(1000, 0)).toBeNull();
    expect(convertThbToUsd(1000, null)).toBeNull();
    expect(convertThbToUsd(null, 33.5)).toBeNull();
  });
});

describe("Allowing a small shortfall from the broker's own currency conversion", () => {
  const min = 29.85;

  it("accepts a deposit within the tolerance below the minimum", () => {
    expect(BROKER_IB_RULES.depositTolerance).toBe(0.05);
    expect(meetsMinimumDeposit(29.85, min)).toBe(true);
    expect(meetsMinimumDeposit(28.4, min)).toBe(true); // ขาด ~4.9%
    expect(meetsMinimumDeposit(30, min)).toBe(true);
  });

  it("rejects a deposit that falls further short than the tolerance", () => {
    expect(meetsMinimumDeposit(28.35, min)).toBe(false); // ขาด ~5.03%
    expect(meetsMinimumDeposit(20, min)).toBe(false);
    expect(meetsMinimumDeposit(0, min)).toBe(false);
  });
});

describe("Each broker has its own baht minimum", () => {
  it("reads the minimum for the broker being claimed", () => {
    expect(minimumForBroker("XM", SETTING)).toEqual({ thb: 1000, usd: 29.85 });
    expect(minimumForBroker("EXNESS", SETTING)).toEqual({ thb: 1500, usd: 44.78 });
  });

  it("returns null for a broker with no minimum set", () => {
    expect(minimumForBroker("EXNESS", { ...SETTING, ibMinDepositExnessThb: null })).toBeNull();
  });
});

describe("Reading the baht minimum and the exchange rate from admin settings", () => {
  it("accepts plain baht amounts and rejects junk or out-of-range values", () => {
    expect(parseMinDepositThb("1000")).toEqual({ ok: true, value: 1000 });
    expect(parseMinDepositThb("1,500")).toEqual({ ok: true, value: 1500 });
    expect(parseMinDepositThb("")).toEqual({ ok: true, value: null });
    expect(parseMinDepositThb("0")).toEqual({ ok: false });
    expect(parseMinDepositThb("1000 บาท")).toEqual({ ok: false });
    expect(parseMinDepositThb("1,0,0,0")).toEqual({ ok: false }); // จุลภาคผิดตำแหน่ง
  });

  it("accepts a believable USD/THB rate only — a typo would move the approval bar", () => {
    expect(parseUsdThbRate("33.5")).toEqual({ ok: true, value: 33.5 });
    expect(parseUsdThbRate("")).toEqual({ ok: true, value: null });
    expect(parseUsdThbRate("0")).toEqual({ ok: false });
    expect(parseUsdThbRate("500")).toEqual({ ok: false });
    expect(parseUsdThbRate("90")).toEqual({ ok: false }); // นอกช่วงที่เป็นไปได้จริง
    expect(parseUsdThbRate("3.35")).toEqual({ ok: false });
  });
});

describe("The offer only opens when a broker has both a link and a baht minimum, plus a rate", () => {
  it("offers each broker with its own minimum in baht and the converted USD figure", () => {
    const availability = computeBrokerIbAvailability(SETTING);
    expect(availability.open && availability.usdThbRate).toBe(33.5);
    expect(availability.open && availability.brokers).toEqual([
      { broker: "XM", label: "XM", link: SETTING.ibXmLink, minDepositThb: 1000, minDepositUsd: 29.85 },
      { broker: "EXNESS", label: "Exness", link: SETTING.ibExnessLink, minDepositThb: 1500, minDepositUsd: 44.78 },
    ]);
  });

  it("leaves out a broker that has a link but no minimum", () => {
    const availability = computeBrokerIbAvailability({ ...SETTING, ibMinDepositExnessThb: null });
    expect(availability.open && availability.brokers.map((offer) => offer.broker)).toEqual(["XM"]);
  });

  it("stays closed without an exchange rate, and when no broker is fully configured", () => {
    expect(computeBrokerIbAvailability({ ...SETTING, ibUsdThbRate: null })).toEqual({ open: false, reason: "NOT_CONFIGURED" });
    expect(computeBrokerIbAvailability({ ...SETTING, ibMinDepositXmThb: null, ibMinDepositExnessThb: null })).toEqual({ open: false, reason: "NOT_CONFIGURED" });
  });
});
