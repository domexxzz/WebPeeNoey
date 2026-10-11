/**
 * รันด้วย `npm run db:seed` (หรืออัตโนมัติหลัง `prisma migrate reset`)
 * ใช้ ADMIN_EMAIL และ SEED_ADMIN_PASSWORD จาก .env — ไม่พิมพ์รหัสผ่านออกหน้าจอ
 */
import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../src/lib/db/seed";

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("ต้องตั้ง ADMIN_EMAIL และ SEED_ADMIN_PASSWORD ใน .env (รัน npm run db:env)");
  }

  const prisma = new PrismaClient();
  try {
    const result = await seedDatabase(prisma, { adminEmail, adminPassword });
    console.log(
      `[seed] แพ็กเกจ ${result.planCount} รายการ, ตั้งค่าระบบพร้อม (ปิดรับชำระเงิน), ` +
        (result.adminCreated ? "สร้างบัญชีแอดมินแล้ว" : "บัญชีแอดมินมีอยู่แล้ว (ไม่เปลี่ยนรหัสผ่าน)"),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("[seed] ล้มเหลว:", error instanceof Error ? error.message : error);
  process.exit(1);
});
