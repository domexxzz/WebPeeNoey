import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedDatabase, SYSTEM_SETTING_ID } from "@/lib/db/seed";
import { updateBrokerIbSettings } from "@/lib/broker-ib/settings";
import { readBrokerIbSettingValues, computeBrokerIbAvailability } from "@/lib/broker-ib/availability";
import { readLockedLinks } from "@/lib/broker-ib/link-lock";
import { createTestPrisma, resetDatabase } from "./helpers";

const prisma = createTestPrisma();
const XM = "https://clicks.pipaffiliates.com/c?c=1263598&l=th&p=1";
const EXNESS = "https://one.exnessonelink.com/a/00awo0516g";
const LOCKED = { XM, EXNESS };

let adminId: string;
const actor = () => ({ id: adminId, ipAddress: "203.0.113.7" });

beforeEach(async () => {
  await resetDatabase(prisma);
  await seedDatabase(prisma, { adminEmail: "admin@example.com", adminPassword: "integration-test-password" });
  adminId = (await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Partner links locked by server environment", () => {
  it("reads only valid https links from XM_PARTNER_LINK / EXNESS_PARTNER_LINK", () => {
    expect(readLockedLinks({ XM_PARTNER_LINK: XM, EXNESS_PARTNER_LINK: EXNESS })).toEqual(LOCKED);
    expect(readLockedLinks({ XM_PARTNER_LINK: "http://evil.example/c", EXNESS_PARTNER_LINK: "" })).toEqual({});
    expect(readLockedLinks({})).toEqual({});
  });

  it("ignores a different link typed in admin settings and stores the locked one", async () => {
    const result = await updateBrokerIbSettings(prisma, {
      actor: actor(),
      ibClaimsEnabled: true,
      xmLink: "https://clicks.pipaffiliates.com/c?c=9999999&p=1",
      exnessLink: "https://one.exnessonelink.com/a/someoneelse",
      xmMinDepositThb: "1000", exnessMinDepositThb: "1500", usdThbRate: "33.5",
      lockedLinks: LOCKED,
    });
    if (!result.ok) throw new Error(result.code);
    const setting = await prisma.systemSetting.findUniqueOrThrow({ where: { id: SYSTEM_SETTING_ID } });
    expect(setting.ibXmLink).toBe(XM);
    expect(setting.ibExnessLink).toBe(EXNESS);
  });

  it("shows the locked links on the site even if the database was changed directly", async () => {
    await prisma.systemSetting.update({
      where: { id: SYSTEM_SETTING_ID },
      data: { ibClaimsEnabled: true, ibMinDepositXmThb: 1000, ibMinDepositExnessThb: 1500, ibUsdThbRate: 33.5, ibXmLink: "https://clicks.pipaffiliates.com/c?c=9999999&p=1", ibExnessLink: "" },
    });
    const values = await readBrokerIbSettingValues(prisma, LOCKED);
    const availability = computeBrokerIbAvailability(values);
    expect(availability.open && availability.brokers.map((offer) => offer.link)).toEqual([XM, EXNESS]);
  });

  it("keeps the old behaviour when nothing is locked", async () => {
    const result = await updateBrokerIbSettings(prisma, {
      actor: actor(),
      ibClaimsEnabled: false,
      xmLink: XM,
      exnessLink: "",
      xmMinDepositThb: "1000", exnessMinDepositThb: "1500", usdThbRate: "33.5",
      lockedLinks: {},
    });
    if (!result.ok) throw new Error(result.code);
    expect((await readBrokerIbSettingValues(prisma, {}))?.ibXmLink).toBe(XM);
  });
});
