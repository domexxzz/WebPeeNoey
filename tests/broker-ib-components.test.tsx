import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BrokerIbSection } from "@/components/marketing/broker-ib-section";
import { BrokerIbStatus } from "@/components/account/broker-ib-status";
import type { BrokerIbMemberStatus } from "@/lib/broker-ib/member-status";
import type { BrokerIbAvailability } from "@/lib/broker-ib/availability";
import { BROKER_IB_CONTENT, BROKER_IB_PLAN } from "@/config/broker-ib";
import { RISK_DISCLAIMER } from "@/config/marketing";
import { PRIVACY_DOCUMENT, REFUND_DOCUMENT, TERMS_DOCUMENT } from "@/content/legal";

vi.mock("@/app/(account)/account/broker-ib/actions", () => ({ submitBrokerClaimAction: vi.fn() }));

const XM = { broker: "XM", label: "XM", link: "https://clicks.pipaffiliates.com/c?c=111&l=en", minDepositThb: 1000, minDepositUsd: 29.85 } as const;
const EXNESS = { broker: "EXNESS", label: "Exness", link: "https://one.exnesstrack.org/a/abc123", minDepositThb: 1500, minDepositUsd: 44.78 } as const;
const OPEN: BrokerIbAvailability = { open: true, usdThbRate: 33.5, brokers: [XM, EXNESS] };
const visibleText = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&");

describe("Public broker IB section", () => {
  const html = renderToStaticMarkup(<BrokerIbSection brokers={[XM, EXNESS]} />);

  it("links to each partner exactly, in a new tab, marked as sponsored", () => {
    for (const offer of [XM, EXNESS]) {
      const escaped = offer.link.replace(/&/g, "&amp;");
      expect(html).toContain(`href="${escaped}"`);
    }
    const anchors = html.match(/<a[^>]*href="https:\/\/(clicks|one)\.[^"]*"[^>]*>/g) ?? [];
    expect(anchors).toHaveLength(2);
    for (const anchor of anchors) {
      expect(anchor).toContain('target="_blank"');
      expect(anchor).toMatch(/rel="sponsored noopener noreferrer"/);
    }
  });

  it("shows only the brokers it is given", () => {
    const onlyXm = renderToStaticMarkup(<BrokerIbSection brokers={[XM]} />);
    expect(onlyXm).not.toContain("exnesstrack");
  });

  it("states the minimum deposit, the risks and the affiliate disclosure, and sends members to the claim page", () => {
    const text = visibleText(html);
    expect(text).toContain("1,000 บาท (XM)");
    expect(text).toContain("1,500 บาท (Exness)");
    for (const risk of BROKER_IB_CONTENT.risks) expect(text).toContain(risk);
    expect(text).toContain(BROKER_IB_CONTENT.disclosure);
    expect(html).toContain('href="/account/broker-ib"');
  });

  it("makes no review, performance or profit claims", () => {
    const text = visibleText(html);
    expect(text).not.toMatch(/รีวิว|%|Win ?Rate|กำไร\s*\d/i);
  });
});

describe("Member broker IB page states", () => {
  const base: Omit<BrokerIbMemberStatus, "state"> = { availability: OPEN, history: [] };
  const render = (state: BrokerIbMemberStatus["state"], availability: BrokerIbAvailability = OPEN) =>
    renderToStaticMarkup(<BrokerIbStatus status={{ ...base, availability, state }} memberEmail="m@example.com" />);

  it("pending: shows the claim being reviewed with the masked account", () => {
    const html = render({ kind: "PENDING", claim: { orderNumber: "IB-20261015-ABC123", submittedAt: new Date("2026-10-15T03:00:00Z"), broker: "XM", platform: "MT5", accountMasked: "****5678", isRenewal: false } });
    expect(html).toContain("รอทีมงานตรวจสอบบัญชี");
    expect(html).toContain("****5678");
    expect(html).not.toContain("<form");
  });

  it("closed: explains and points to paid plans", () => {
    const html = render({ kind: "CLOSED", ibActiveUntil: null }, { open: false, reason: "DISABLED" });
    expect(html).toContain("ปิดรับคำขอ");
    expect(html).toContain('href="/#pricing"');
  });

  it("waiting window: tells the member when they can submit", () => {
    const html = render({ kind: "WAIT_WINDOW", opensAt: new Date("2026-11-07T00:00:00Z"), coveredUntil: new Date("2026-11-14T00:00:00Z") });
    expect(html).toContain("ยื่นคำขอสิทธิ์ผ่านโบรกเกอร์ได้ตั้งแต่วันที่");
    expect(html).not.toContain("<form");
  });

  it("new claim: steps with partner links and a form that never asks for a password", () => {
    const html = render({ kind: "CAN_CLAIM", binding: null, lastRejection: { reason: "ยอดฝากยังไม่ถึงขั้นต่ำ", at: new Date("2026-10-14T00:00:00Z") } });
    expect(html).toContain('name="accountNumber"');
    expect(html).toContain('name="registeredEmail"');
    expect(html).toContain('value="m@example.com"');
    expect(html).toContain('name="confirmDeposit"');
    expect(html).toContain('name="acceptTerms"');
    expect(html).not.toMatch(/type="password"/);
    expect(html).toContain(BROKER_IB_CONTENT.noPasswordNote);
    expect(html).toContain("ยอดฝากยังไม่ถึงขั้นต่ำ");
    expect(html).toContain(XM.link.replace(/&/g, "&amp;"));
  });

  it("renewal: confirms the verified account without re-entering details", () => {
    const html = render({ kind: "CAN_RENEW", binding: { broker: "XM", platform: "MT5", accountMasked: "****5678", status: "VERIFIED" }, ibActiveUntil: new Date("2026-11-14T00:00:00Z"), lastRejection: null });
    expect(html).toContain('value="RENEW"');
    expect(html).toContain('name="confirmStillActive"');
    expect(html).not.toContain('name="accountNumber"');
  });
});

describe("Legal text covers the IB program", () => {
  it("terms have an IB section with the one-account rule, renewal re-check and third-party broker terms", () => {
    const section = TERMS_DOCUMENT.sections.find((item) => item.id === "broker-ib");
    expect(section).toBeDefined();
    const text = section?.bullets?.join(" ") ?? "";
    expect(text).toContain("1 บัญชี");
    expect(text).toContain(`มีอายุ ${BROKER_IB_PLAN.durationDays} วัน`);
    expect(text).toContain("บุคคลภายนอก");
    expect(text).toContain("ค่าตอบแทน");
    // หัวข้อเรียงเลขต่อเนื่อง
    TERMS_DOCUMENT.sections.forEach((item, index) => expect(item.heading.startsWith(`${index + 1}. `)).toBe(true));
  });

  it("privacy lists the trading-account data and refund policy excludes free IB grants", () => {
    expect(PRIVACY_DOCUMENT.sections.flatMap((item) => item.bullets ?? []).join(" ")).toContain("เลขบัญชีเทรด");
    expect(REFUND_DOCUMENT.sections.flatMap((item) => item.bullets ?? []).join(" ")).toContain("โปรแกรม IB");
    expect(RISK_DISCLAIMER.length).toBeGreaterThan(0);
  });
});
