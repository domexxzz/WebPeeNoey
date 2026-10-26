import { describe, expect, it } from "vitest";
import { claimWindowOpensAt, isWithinClaimWindow, resolveBrokerIbMemberState, type MemberStateInput } from "@/lib/broker-ib/rules";
import { BROKER_IB_PLAN, BROKER_IB_RULES } from "@/config/broker-ib";
import { LEGAL_DOCUMENTS } from "@/content/legal";
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
  const WINDOW = BROKER_IB_RULES.renewalWindowDays;

  it("opens when the next period starts within the renewal window (or there is no coverage)", () => {
    expect(isWithinClaimWindow(NOW, NOW)).toBe(true);
    expect(isWithinClaimWindow(inDays(WINDOW), NOW)).toBe(true);
    expect(isWithinClaimWindow(new Date(inDays(WINDOW).getTime() + 1), NOW)).toBe(false);
  });

  it("tells the member when the window opens", () => {
    expect(claimWindowOpensAt(inDays(30))).toEqual(inDays(30 - WINDOW));
  });

  /**
   * ถ้าช่วงยื่นต่ออายุยาวเท่ากับหรือเกินอายุสิทธิ์ หน้าต่างจะเปิดค้างตลอด
   * สมาชิกยื่นต่อได้ทันทีที่เพิ่งได้รับอนุมัติ = สะสมสิทธิ์ฟรีไม่จำกัดจากการฝากเงินครั้งเดียว
   */
  it("closes right after an approval, so free periods cannot be stacked", () => {
    expect(WINDOW).toBeLessThan(BROKER_IB_PLAN.durationDays);
    const justApprovedNextStart = inDays(BROKER_IB_PLAN.durationDays);
    expect(isWithinClaimWindow(justApprovedNextStart, NOW)).toBe(false);
  });

  it("states the real entitlement length in the terms, not a number typed by hand", () => {
    const ibSection = Object.values(LEGAL_DOCUMENTS)
      .flatMap((doc) => doc.sections)
      .flatMap((section) => section.bullets ?? []);
    const durationLine = ibSection.find((line) => line.includes("สิทธิ์แต่ละครั้งมีอายุ"));
    expect(durationLine).toContain(`มีอายุ ${BROKER_IB_PLAN.durationDays} วัน`);
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

  it("asks to wait when more access remains than the renewal window (e.g. a paid plan)", () => {
    const window = BROKER_IB_RULES.renewalWindowDays;
    expect(resolveBrokerIbMemberState({ ...base, nextStart: inDays(20) })).toEqual({ kind: "WAIT_WINDOW", opensAt: inDays(20 - window), coveredUntil: inDays(20) });
  });

  it("offers renewal for a verified account inside the window", () => {
    const nearlyOver = inDays(BROKER_IB_RULES.renewalWindowDays);
    expect(resolveBrokerIbMemberState({ ...base, binding: verified, nextStart: nearlyOver, ibActiveUntil: nearlyOver })).toEqual({
      kind: "CAN_RENEW",
      binding: verified,
      ibActiveUntil: nearlyOver,
      lastRejection: null,
    });
  });

  it("offers a new claim otherwise, with the last rejection reason", () => {
    const lastRejection = { reason: "ยอดฝากยังไม่ถึงขั้นต่ำ", at: NOW };
    expect(resolveBrokerIbMemberState({ ...base, lastRejection })).toEqual({ kind: "CAN_CLAIM", binding: null, lastRejection });
  });
});
