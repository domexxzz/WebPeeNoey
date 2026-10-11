import { PrismaClient } from "@prisma/client";

/** Prisma client ที่ชี้ไปฐานข้อมูลทดสอบ (vitest.integration.config.ts ตั้ง DATABASE_URL = DATABASE_URL_TEST) */
export function createTestPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("_test")) throw new Error("Integration test ต้องรันกับฐานข้อมูล _test เท่านั้น");
  return new PrismaClient({ datasources: { db: { url } } });
}

/** ล้างข้อมูลทุกตาราง (ยกเว้นตารางของ Prisma Migrate) ให้แต่ละเทสต์เริ่มจากฐานข้อมูลว่าง */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
