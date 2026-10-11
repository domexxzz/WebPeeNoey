import { execSync } from "child_process";
import { loadEnv } from "vite";

/** ป้องกันไม่ให้ Integration Test ไปลบข้อมูลในฐานข้อมูลอื่นนอกจากฐานข้อมูลทดสอบบนเครื่อง */
export function assertSafeTestDatabaseUrl(rawUrl: string | undefined): URL {
  if (!rawUrl) throw new Error("ไม่พบ DATABASE_URL_TEST ใน .env (รัน npm run db:env)");
  const url = new URL(rawUrl);
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("DATABASE_URL_TEST ต้องชี้ไปที่ localhost เท่านั้น");
  }
  if (!url.pathname.replace(/^\//, "").endsWith("_test")) {
    throw new Error("ชื่อฐานข้อมูลใน DATABASE_URL_TEST ต้องลงท้ายด้วย _test");
  }
  return url;
}

export default function setup() {
  const env = loadEnv("test", process.cwd(), "");
  assertSafeTestDatabaseUrl(env.DATABASE_URL_TEST);

  // สร้าง/อัปเดตตารางในฐานข้อมูลทดสอบให้ตรงกับ migration ล่าสุด
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: env.DATABASE_URL_TEST },
  });
}
