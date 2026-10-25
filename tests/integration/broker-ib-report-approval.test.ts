import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "crypto";
import { seedDatabase, SYSTEM_SETTING_ID } from "@/lib/db/seed";
import { updateBrokerIbSettings } from "@/lib/broker-ib/settings";
import { createBrokerClaim, type BrokerClaimInput } from "@/lib/broker-ib/claims";
import { approveQualifyingClaims, previewReportMatches } from "@/lib/broker-ib/report-review";
import type { AccountEvidence } from "@/lib/broker-ib/report-import";
import { createTestPrisma, resetDatabase } from "./helpers";

const prisma = createTestPrisma();
const T0 = new Date("2026-10-25T03:00:00Z");

let adminId: string;
const actor = () => ({ id: adminId, ipAddress: "203.0.113.7" });

async function member() {
  return prisma.user.create({ data: { email: `m-${randomBytes(4).toString("hex")}@example.com`, role: "USER", passwordHash: "x" } });
}

async function claim(userId: string, input: Partial<BrokerClaimInput> = {}) {
  const full = { mode: "NEW", broker: "XM", platform: "MT5", accountNumber: "322163030", registeredEmail: "trader@example.com", ...input } as BrokerClaimInput;
  const result = await createBrokerClaim(prisma, { userId, claim: full, termsVersion: "2026-10-15", ipAddress: "198.51.100.4", now: T0 });
  if (!result.ok) throw new Error(result.code);
  return result.orderId;
}

const evidence = (entries: [string, AccountEvidence][]) => new Map(entries);

beforeEach(async () => {
  await resetDatabase(prisma);
  await seedDatabase(prisma, { adminEmail: "admin@example.com", adminPassword: "integration-test-password" });
  adminId = (await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })).id;
  await prisma.systemSetting.update({ where: { id: SYSTEM_SETTING_ID }, data: { paymentsEnabled: true, promptpayNumber: "0812345678", promptpayAccountName: "บัญชีทดสอบ" } });
  const settings = await updateBrokerIbSettings(prisma, {
    actor: actor(),
    ibClaimsEnabled: true,
    xmLink: "https://clicks.pipaffiliates.com/c?c=1",
    exnessLink: "https://one.exnesstrack.org/a/abc",
    xmMinDepositThb: "1000", exnessMinDepositThb: "1500", usdThbRate: "33.5",
  });
  if (!settings.ok) throw new Error(settings.code);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integration: approve IB claims from uploaded partner reports", () => {
  it("previews every pending claim with its verdict and changes nothing", async () => {
    const qualifying = await claim((await member()).id);
    const short = await claim((await member()).id, { accountNumber: "411120876" });
    const exness = await claim((await member()).id, { broker: "EXNESS", accountNumber: "81234567" });

    const preview = await previewReportMatches(prisma, {
      XM: evidence([["322163030", { emails: [], depositUsd: 150 }], ["411120876", { emails: [], depositUsd: 20 }]]),
    });

    const byId = Object.fromEntries(preview.map((row) => [row.orderId, row.verdict]));
    expect(byId).toEqual({ [qualifying]: "QUALIFIES", [short]: "DEPOSIT_BELOW", [exness]: "NO_REPORT_FOR_BROKER" });
    expect(await prisma.order.count({ where: { status: "APPROVED" } })).toBe(0);
  });

  it("approves only qualifying claims, creates their 30-day access and records the report import", async () => {
    const userId = (await member()).id;
    const qualifying = await claim(userId);
    const mismatch = await claim((await member()).id, { broker: "EXNESS", accountNumber: "81234567", registeredEmail: "real@example.com" });

    const result = await approveQualifyingClaims(prisma, {
      actor: actor(),
      evidenceByBroker: {
        XM: evidence([["322163030", { emails: [], depositUsd: 150 }]]),
        EXNESS: evidence([["81234567", { emails: ["someone@else.com"], depositUsd: 500 }]]),
      },
      sourceFiles: ["xm-traders.csv", "exness-accounts.csv"],
      now: T0,
    });

    expect(result.approved.map((row) => row.orderId)).toEqual([qualifying]);
    expect(result.skipped.find((row) => row.orderId === mismatch)?.verdict).toBe("EMAIL_MISMATCH");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: qualifying } })).status).toBe("APPROVED");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: mismatch } })).status).toBe("CLAIM_SUBMITTED");

    const subscription = await prisma.subscription.findFirstOrThrow({ where: { userId } });
    expect(subscription.currentPeriodEnd.getTime() - subscription.currentPeriodStart.getTime()).toBe(30 * 24 * 60 * 60 * 1000);

    const approval = await prisma.auditLog.findFirstOrThrow({ where: { action: "BROKER_CLAIM_APPROVE", targetId: qualifying } });
    expect(approval.actorId).toBe(adminId);
    expect(JSON.stringify(approval.details)).toContain("xm-traders.csv");
    const importLog = await prisma.auditLog.findFirstOrThrow({ where: { action: "BROKER_REPORT_IMPORT" } });
    expect(importLog.details).toMatchObject({ approved: 1, skipped: 1, files: ["xm-traders.csv", "exness-accounts.csv"] });
    expect(JSON.stringify(importLog.details)).not.toContain("81234567"); // ไม่เก็บเลขบัญชีของคนที่ไม่ผ่านไว้ในสรุป
  });

  it("is safe to run twice: an already-approved claim is not approved again", async () => {
    const qualifying = await claim((await member()).id);
    const input = {
      actor: actor(),
      evidenceByBroker: { XM: evidence([["322163030", { emails: [], depositUsd: 150 }]]) },
      sourceFiles: ["xm.csv"],
      now: T0,
    };
    const [first, second] = await Promise.all([approveQualifyingClaims(prisma, input), approveQualifyingClaims(prisma, input)]);
    expect(first.approved.length + second.approved.length).toBe(1);
    expect(await prisma.subscription.count({ where: { orderId: qualifying } })).toBe(1);
  });
});
