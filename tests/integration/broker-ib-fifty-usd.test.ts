import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "crypto";
import { seedDatabase, SYSTEM_SETTING_ID } from "@/lib/db/seed";
import { updateBrokerIbSettings } from "@/lib/broker-ib/settings";
import { getBrokerIbAvailability } from "@/lib/broker-ib/availability";
import { createBrokerClaim } from "@/lib/broker-ib/claims";
import { approveBrokerClaim } from "@/lib/broker-ib/review";
import { getMembershipSummary } from "@/lib/admin/membership";
import { BROKER_IB_PLAN, BROKER_ORDER } from "@/config/broker-ib";
import { createTestPrisma, resetDatabase } from "./helpers";

/**
 * ข้อตกลงกับพาร์ทเนอร์: ฝากขั้นต่ำ 50 USD เท่ากันทั้ง XM และ Exness แล้วได้ใช้งานฟรี 1 สัปดาห์
 * ระบบเก็บขั้นต่ำเป็น "เงินบาท" รายโบรกเกอร์ แล้วแปลงเป็น USD ด้วยอัตราที่แอดมินตั้ง
 * เทสต์นี้จึงยึดที่ผลลัพธ์ปลายทาง (ลูกค้าเห็น 50 USD เท่ากัน และได้สิทธิ์ 7 วันพอดี)
 * ไม่ใช่ที่ตัวเลขบาทตัวใดตัวหนึ่ง ซึ่งเปลี่ยนตามอัตราแลกเปลี่ยน
 */
const prisma = createTestPrisma();
const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-10-27T03:00:00Z");
const day = (n: number) => new Date(T0.getTime() + n * DAY_MS);

/** ยอดที่ตกลงกันไว้ — ถ้าเปลี่ยนข้อตกลง ต้องแก้ที่นี่ให้ตรงกับที่ตั้งใน /admin/settings */
const AGREED_USD = 50;

let adminId: string;
const actor = () => ({ id: adminId, ipAddress: "203.0.113.9" });

/** ตั้งขั้นต่ำให้เท่ากับ AGREED_USD ทั้งสองโบรกเกอร์ ที่อัตราแลกเปลี่ยนที่กำหนด */
async function setMinimumsAt(rate: number) {
  const thb = (AGREED_USD * rate).toFixed(2);
  const result = await updateBrokerIbSettings(prisma, {
    actor: actor(),
    ibClaimsEnabled: true,
    xmLink: "https://clicks.pipaffiliates.com/c?c=1",
    exnessLink: "https://one.exnesstrack.org/a/abc",
    xmMinDepositThb: thb,
    exnessMinDepositThb: thb,
    usdThbRate: String(rate),
  });
  if (!result.ok) throw new Error(result.code);
  return Number(thb);
}

beforeEach(async () => {
  await resetDatabase(prisma);
  await seedDatabase(prisma, { adminEmail: "admin@example.com", adminPassword: "integration-test-password" });
  adminId = (await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })).id;
  await prisma.systemSetting.update({ where: { id: SYSTEM_SETTING_ID }, data: { maintenanceMode: false } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integration: 50 USD at both brokers, 7 free days", () => {
  it("shows the same 50 USD minimum for XM and Exness", async () => {
    const thb = await setMinimumsAt(33.5);

    const offer = await getBrokerIbAvailability(prisma);

    expect(offer.open).toBe(true);
    if (!offer.open) return;
    expect(offer.brokers.map((broker) => broker.broker).sort()).toEqual([...BROKER_ORDER].sort());
    for (const broker of offer.brokers) {
      expect(broker.minDepositUsd).toBe(AGREED_USD);
      expect(broker.minDepositThb).toBe(thb);
    }
    // ทั้งสองโบรกเกอร์ต้องเท่ากันจริง ๆ ไม่ใช่บังเอิญเท่ากันเพราะปัดเศษ
    expect(new Set(offer.brokers.map((broker) => broker.minDepositThb)).size).toBe(1);
  });

  /** อัตราแลกเปลี่ยนเปลี่ยนได้ ข้อตกลงคือ 50 USD จึงต้องยังเป็น 50 USD ที่อัตราไหนก็ตาม */
  it("still means 50 USD after the exchange rate is updated", async () => {
    for (const rate of [31, 33.5, 36.25]) {
      const thb = await setMinimumsAt(rate);
      const offer = await getBrokerIbAvailability(prisma);
      expect(offer.open).toBe(true);
      if (!offer.open) continue;
      expect(offer.usdThbRate).toBe(rate);
      expect(offer.brokers.map((broker) => broker.minDepositUsd)).toEqual([AGREED_USD, AGREED_USD]);
      expect(thb).toBe(Number((AGREED_USD * rate).toFixed(2)));
    }
  });

  it("grants exactly seven free days when the claim is approved", async () => {
    await setMinimumsAt(33.5);
    const user = await prisma.user.create({
      data: { email: `m-${randomBytes(4).toString("hex")}@example.com`, role: "USER", passwordHash: "x" },
    });

    const claim = await createBrokerClaim(prisma, {
      userId: user.id,
      claim: { mode: "NEW", broker: "EXNESS", platform: "MT5", accountNumber: "87654321", registeredEmail: "trader@example.com" },
      termsVersion: "2026-10-27",
      now: T0,
    });
    if (!claim.ok) throw new Error(claim.code);

    const approved = await approveBrokerClaim(prisma, {
      orderId: claim.orderId,
      actor: actor(),
      checks: { underIb: true, emailMatches: true, qualifies: true },
      now: T0,
    });
    expect(approved).toMatchObject({ ok: true });

    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { orderId: claim.orderId } });
    expect(subscription.currentPeriodStart).toEqual(T0);
    expect(subscription.currentPeriodEnd).toEqual(day(BROKER_IB_PLAN.durationDays));
    expect(subscription.currentPeriodEnd.getTime() - subscription.currentPeriodStart.getTime()).toBe(7 * DAY_MS);
    expect(subscription.status).toBe("ACTIVE");

    // ฟรีจริง — ออเดอร์ของสิทธิ์ผ่าน IB ต้องเป็นศูนย์บาท
    const order = await prisma.order.findUniqueOrThrow({ where: { id: claim.orderId } });
    expect(order.amount.toNumber()).toBe(0);

    // ใช้งานได้ตลอดเจ็ดวัน และหมดพอดีเมื่อครบ
    expect(await getMembershipSummary(prisma, { userId: user.id, now: day(6.9) })).toMatchObject({ active: true });
    expect(await getMembershipSummary(prisma, { userId: user.id, now: day(7.1) })).toMatchObject({ active: false, endsAt: null });
  });
});
