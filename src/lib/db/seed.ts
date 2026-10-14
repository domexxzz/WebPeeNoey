import type { Prisma, PrismaClient } from "@prisma/client";
import { SITE_PLANS } from "@/config/plans";
import { BROKER_IB_PLAN } from "@/config/broker-ib";
import { hashPassword } from "@/lib/security";
import { SYSTEM_SETTING_ID } from "./constants";

/**
 * ข้อมูลตั้งต้นของระบบ (ใช้ทั้ง `npm run db:seed` และ Integration Test)
 * ทุกขั้นตอนเป็น upsert — รันซ้ำกี่ครั้งก็ได้ผลเหมือนเดิม
 */

export { SYSTEM_SETTING_ID };
const MIN_ADMIN_PASSWORD_LENGTH = 12;

export interface SeedOptions {
  adminEmail: string;
  adminPassword: string;
}

export interface SeedResult {
  planCount: number;
  adminCreated: boolean;
}

/** แปลงแพ็กเกจจาก src/config/plans.ts (แหล่งข้อมูลหลัก) เป็นแถวในตาราง Plan */
export function buildPlanRecords(): Prisma.PlanCreateInput[] {
  return SITE_PLANS.map((plan, index) => ({
    slug: plan.slug,
    name: plan.name,
    durationDays: plan.durationDays,
    price: plan.price,
    originalPrice: plan.originalPrice,
    isPromo: plan.isPromo,
    promoLimit: plan.promoLimit ?? null,
    lockPriceForLife: plan.lockPriceForLife,
    features: plan.features,
    sortOrder: index,
    isActive: true,
  }));
}

export function validateSeedOptions({ adminEmail, adminPassword }: SeedOptions): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new Error("ADMIN_EMAIL ไม่ถูกต้อง");
  }
  if (adminPassword.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(`SEED_ADMIN_PASSWORD ต้องยาวอย่างน้อย ${MIN_ADMIN_PASSWORD_LENGTH} ตัวอักษร`);
  }
}

async function seedPlans(prisma: PrismaClient): Promise<number> {
  const records = buildPlanRecords();
  for (const record of records) {
    // ไม่อัปเดต promoEnrolledCount: เป็นตัวนับจากออเดอร์จริง ห้าม seed ทับ
    await prisma.plan.upsert({ where: { slug: record.slug }, create: record, update: record });
  }
  return records.length;
}

/** แพ็กเกจสิทธิ์ฟรีผ่าน IB (ราคา 0) — แยกจาก buildPlanRecords เพราะห้ามขายผ่าน Checkout (migration ก็สร้างแถวนี้ให้ production) */
async function seedBrokerIbPlan(prisma: PrismaClient): Promise<void> {
  const record = {
    slug: BROKER_IB_PLAN.slug,
    name: BROKER_IB_PLAN.name,
    durationDays: BROKER_IB_PLAN.durationDays,
    price: 0,
    features: [...BROKER_IB_PLAN.features],
    sortOrder: BROKER_IB_PLAN.sortOrder,
    isActive: true,
    kind: "BROKER_IB" as const,
  };
  await prisma.plan.upsert({ where: { slug: record.slug }, create: { id: BROKER_IB_PLAN.id, ...record }, update: record });
}

async function seedSystemSetting(prisma: PrismaClient): Promise<void> {
  // สร้างแถวเริ่มต้นเท่านั้น ไม่เขียนทับค่าที่แอดมินตั้งไว้แล้ว — และปิดรับชำระเงินเสมอเมื่อสร้างใหม่
  await prisma.systemSetting.upsert({
    where: { id: SYSTEM_SETTING_ID },
    create: { id: SYSTEM_SETTING_ID, paymentsEnabled: false },
    update: {},
  });
}

async function seedAdmin(prisma: PrismaClient, { adminEmail, adminPassword }: SeedOptions): Promise<boolean> {
  const email = adminEmail.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });

  // เป็นแอดมินอยู่แล้ว: ไม่แตะอะไร (ไม่ทับรหัสผ่านที่แอดมินเปลี่ยนเอง)
  if (existing?.role === "ADMIN") return false;

  if (existing) {
    // บัญชีสมาชิกทั่วไปที่ใช้ ADMIN_EMAIL: เลื่อนเป็นแอดมินพร้อมตั้งรหัสผ่านเป็น SEED_ADMIN_PASSWORD
    // เพราะยังไม่มีการยืนยันอีเมล — บัญชีนี้อาจถูกคนอื่นสมัครดักไว้ก่อน รหัสผ่านเดิมจึงเชื่อไม่ได้
    await prisma.user.update({
      where: { email },
      data: { role: "ADMIN", passwordHash: await hashPassword(adminPassword) },
    });
    console.warn("[seed] บัญชี ADMIN_EMAIL มีอยู่แล้วในฐานะสมาชิก — เลื่อนเป็นแอดมินและเปลี่ยนรหัสผ่านเป็น SEED_ADMIN_PASSWORD");
    return false;
  }

  await prisma.user.create({
    data: { email, name: "Admin", role: "ADMIN", passwordHash: await hashPassword(adminPassword) },
  });
  return true;
}

export async function seedDatabase(prisma: PrismaClient, options: SeedOptions): Promise<SeedResult> {
  validateSeedOptions(options);
  const planCount = await seedPlans(prisma);
  await seedBrokerIbPlan(prisma);
  await seedSystemSetting(prisma);
  const adminCreated = await seedAdmin(prisma, options);
  return { planCount, adminCreated };
}
