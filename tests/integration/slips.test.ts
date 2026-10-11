import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "crypto";
import { SITE_PLANS } from "@/config/plans";
import { seedDatabase, SYSTEM_SETTING_ID } from "@/lib/db/seed";
import { createOrder, submitSlip } from "@/lib/orders/checkout";
import { getSlipForViewer } from "@/lib/orders/slips";
import { createTestPrisma, resetDatabase } from "./helpers";

const prisma = createTestPrisma();
const NOW = new Date("2026-10-11T03:00:00Z");

async function member() {
  return prisma.user.create({ data: { email: `m-${randomBytes(4).toString("hex")}@example.com`, role: "USER", passwordHash: "x" } });
}

async function uploadedSlip() {
  const owner = await member();
  const created = await createOrder(prisma, { userId: owner.id, planSlug: SITE_PLANS[0].slug, now: NOW });
  if (!created.ok) throw new Error(created.code);
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from(randomBytes(32))]);
  const submitted = await submitSlip(prisma, { userId: owner.id, orderId: created.orderId, bytes, now: NOW });
  if (!submitted.ok) throw new Error(submitted.code);
  return { owner, uploadId: submitted.uploadId, bytes };
}

beforeEach(async () => {
  await resetDatabase(prisma);
  await seedDatabase(prisma, { adminEmail: "admin@example.com", adminPassword: "integration-test-password" });
  await prisma.systemSetting.update({
    where: { id: SYSTEM_SETTING_ID },
    data: { paymentsEnabled: true, promptpayNumber: "0812345678", promptpayAccountName: "บัญชีทดสอบ" },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integration: slip access control", () => {
  it("returns the exact stored image to the order owner", async () => {
    const { owner, uploadId, bytes } = await uploadedSlip();

    const slip = await getSlipForViewer(prisma, { slipId: uploadId, viewer: { id: owner.id, role: "USER" } });

    expect(slip?.mimeType).toBe("image/jpeg");
    expect(Buffer.from(slip!.data).equals(Buffer.from(bytes))).toBe(true);
  });

  it("returns the slip to admins", async () => {
    const { uploadId } = await uploadedSlip();
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });

    expect(await getSlipForViewer(prisma, { slipId: uploadId, viewer: { id: admin.id, role: "ADMIN" } })).not.toBeNull();
  });

  it("hides slips from other members and unknown ids (no existence leak)", async () => {
    const { uploadId } = await uploadedSlip();
    const stranger = await member();

    expect(await getSlipForViewer(prisma, { slipId: uploadId, viewer: { id: stranger.id, role: "USER" } })).toBeNull();
    expect(await getSlipForViewer(prisma, { slipId: "does-not-exist", viewer: { id: stranger.id, role: "ADMIN" } })).toBeNull();
  });

  it("does not trust a client-supplied ADMIN role for users who are not admins in the database", async () => {
    const { uploadId } = await uploadedSlip();
    const stranger = await member();

    expect(await getSlipForViewer(prisma, { slipId: uploadId, viewer: { id: stranger.id, role: "ADMIN" } })).toBeNull();
  });
});
