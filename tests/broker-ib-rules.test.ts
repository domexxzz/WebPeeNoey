import { describe, expect, it } from "vitest";
import { claimWindowOpensAt, isWithinClaimWindow, resolveBrokerIbMemberState, type MemberStateInput } from "@/lib/broker-ib/rules";
import type { BrokerIbAvailability } from "@/lib/broker-ib/availability";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-15T03:00:00Z");
const inDays = (n: number) => new Date(NOW.getTime() + n * DAY_MS);

const OPEN: BrokerIbAvailability = { open: true, usdThbRate: 33.5, brokers: [{ broker: "XM", label: "XM", link: "https://clicks.pipaffiliates.com/c?c=1", minDepositThb: 1000, minDepositUsd: 29.85 }] };
const verified = { broker: "XM", platform: "MT5", accountMasked: "****5678", status: "VERIFIED" } as const;
const base: MemberStateInput = {
  now: NOW,
  availability: OPEN,
  pendingClaim: null,
  binding: null,
  nextStart: NOW,
  ibActiveUntil: null,
  lastRejection: null,
};

describe("broker IB claim window", () => {
  it("opens when the next period starts within 7 days (or there is no coverage)", () => {
    expect(isWithinClaimWindow(NOW, NOW)).toBe(true);
    expect(isWithinClaimWindow(inDays(7), NOW)).toBe(true);
    expect(isWithinClaimWindow(new Date(inDays(7).getTime() + 1), NOW)).toBe(false);
  });

  it("tells the member when the window opens", () => {
    expect(claimWindowOpensAt(inDays(30))).toEqual(inDays(23));
  });
});

describe("broker IB member state", () => {
  it("shows a pending claim first, even when IB has been switched off", () => {
    const pendingClaim = { orderNumber: "IB-1", submittedAt: NOW, broker: "XM", platform: "MT5", accountMasked: "****5678", isRenewal: false } as const;
    expect(resolveBrokerIbMemberState({ ...base, pendingClaim, availability: { open: false, reason: "DISABLED" } })).toEqual({ kind: "PENDING", claim: pendingClaim });
  });

  it("is closed when IB is off, still reporting an active IB grant", () => {
    expect(resolveBrokerIbMemberState({ ...base, availability: { open: false, reason: "DISABLED" }, ibActiveUntil: inDays(10) })).toEqual({
      kind: "CLOSED",
      ibActiveUntil: inDays(10),
    });
  });

  it("asks to wait when more than 7 days of access remain (e.g. a paid plan)", () => {
    expect(resolveBrokerIbMemberState({ ...base, nextStart: inDays(20) })).toEqual({ kind: "WAIT_WINDOW", opensAt: inDays(13), coveredUntil: inDays(20) });
  });

  it("offers renewal for a verified account inside the window", () => {
    expect(resolveBrokerIbMemberState({ ...base, binding: verified, nextStart: inDays(5), ibActiveUntil: inDays(5) })).toEqual({
      kind: "CAN_RENEW",
      binding: verified,
      ibActiveUntil: inDays(5),
      lastRejection: null,
    });
  });

  it("offers a new claim otherwise, with the last rejection reason", () => {
    const lastRejection = { reason: "ยอดฝากยังไม่ถึงขั้นต่ำ", at: NOW };
    expect(resolveBrokerIbMemberState({ ...base, lastRejection })).toEqual({ kind: "CAN_CLAIM", binding: null, lastRejection });
  });
});
