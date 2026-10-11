import type { Prisma, PrismaClient } from "@prisma/client";
import { SITE_PLANS } from "@/config/plans";
import { hashPassword } from "@/lib/security";

/**
 * ข้อมูลตั้งต้นของระบบ (ใช้ทั้ง `npm run db:seed` และ Integration Test)
 * ทุกขั้นตอนเป็น upsert — รันซ้ำกี่ครั้งก็ได้ผลเหมือนเดิม
 */

export const SYSTEM_SETTING_ID = "default";
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
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (existing) {
    // มีบัญชีอยู่แล้ว: ยืนยันสิทธิ์ ADMIN แต่ไม่เปลี่ยนรหัสผ่านที่ผู้ใช้อาจตั้งใหม่ไปแล้ว
    await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
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
  await seedSystemSetting(prisma);
  const adminCreated = await seedAdmin(prisma, options);
  return { planCount, adminCreated };
}
