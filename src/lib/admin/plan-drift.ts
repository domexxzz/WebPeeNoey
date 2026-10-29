import type { PrismaClient } from "@prisma/client";
import { BROKER_IB_PLAN } from "@/config/broker-ib";
import { SITE_PLANS } from "@/config/plans";

/**
 * จำนวนวันของแพ็กเกจในโค้ด (config) เทียบกับแถว Plan ในฐานข้อมูล
 *
 * ทำไมต้องมี: การอนุมัติจริงคำนวณวันหมดอายุจากแถว Plan ส่วนหน้าเว็บโชว์ตัวเลขจาก config
 * ถ้าสองที่ไม่ตรงกัน ลูกค้าได้สิทธิ์ไม่ตรงกับที่เว็บบอก — เกิดจริง 29 ต.ค. 2569: migration เปลี่ยนสิทธิ์ทดลอง IB
 * ไม่ได้รันบนฐานข้อมูลจริง ลูกค้าได้วันเกินโดยไม่มีอะไรเตือน (ดู docs/HANDOFF.md)
 */
export interface PlanDrift {
  slug: string;
  name: string;
  codeDays: number;
  /** null = ไม่มีแถวนี้ในฐานข้อมูล หรือถูกปิดไว้ (isActive = false) — ขาย/อนุมัติแพ็กเกจนี้ไม่ได้ */
  databaseDays: number | null;
}

const CODE_PLANS = [...SITE_PLANS, BROKER_IB_PLAN].map((plan) => ({ slug: plan.slug, name: plan.name, codeDays: plan.durationDays }));

export async function findPlanDrift(db: PrismaClient): Promise<PlanDrift[]> {
  const rows = await db.plan.findMany({
    where: { slug: { in: CODE_PLANS.map((plan) => plan.slug) }, isActive: true },
    select: { slug: true, durationDays: true },
  });
  const daysBySlug = new Map(rows.map((row) => [row.slug, row.durationDays]));
  return CODE_PLANS.filter((plan) => daysBySlug.get(plan.slug) !== plan.codeDays).map((plan) => ({
    ...plan,
    databaseDays: daysBySlug.get(plan.slug) ?? null,
  }));
}

export function describePlanDrift(drift: PlanDrift): string {
  return drift.databaseDays === null
    ? `${drift.slug}: ไม่มีในฐานข้อมูล (หรือถูกปิดไว้) แต่โค้ดใช้ ${drift.codeDays} วัน`
    : `${drift.slug}: ฐานข้อมูล ${drift.databaseDays} วัน แต่โค้ด ${drift.codeDays} วัน`;
}
