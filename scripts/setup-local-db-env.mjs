/**
 * เตรียมค่าใน .env สำหรับ PostgreSQL บน Docker (รัน: npm run db:env)
 *
 * - อ่าน DATABASE_URL ที่มีอยู่แล้ว แล้วเติม POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB ให้ตรงกัน
 * - เติม DATABASE_URL_TEST (ฐานข้อมูล <ชื่อ>_test) สำหรับ Integration Test
 * - สร้าง SEED_ADMIN_PASSWORD แบบสุ่ม สำหรับบัญชีแอดมินทดสอบ
 *
 * เติมเฉพาะคีย์ที่ยังไม่มี และไม่พิมพ์ค่าความลับออกหน้าจอ (CLAUDE.md ข้อ 4)
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const ENV_PATH = ".env";

function fail(message) {
  console.error(`[db:env] ${message}`);
  process.exit(1);
}

if (!existsSync(ENV_PATH)) fail("ไม่พบไฟล์ .env — คัดลอกจาก .env.example ก่อน");

const content = readFileSync(ENV_PATH, "utf8");
const existingKeys = new Set(
  content
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1])
    .filter(Boolean),
);

const rawUrl = content.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
if (!rawUrl) fail("ไม่พบ DATABASE_URL ใน .env");

let url;
try {
  url = new URL(rawUrl);
} catch {
  fail("DATABASE_URL อ่านค่าไม่ได้");
}
if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
  fail("DATABASE_URL ไม่ได้ชี้ไปที่ localhost — สคริปต์นี้ใช้กับฐานข้อมูลบนเครื่องเท่านั้น");
}

const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
if (!database) fail("DATABASE_URL ไม่มีชื่อฐานข้อมูล");

const testUrl = new URL(url.toString());
testUrl.pathname = `/${encodeURIComponent(`${database}_test`)}`;

const derived = {
  POSTGRES_USER: decodeURIComponent(url.username),
  POSTGRES_PASSWORD: decodeURIComponent(url.password),
  POSTGRES_DB: database,
  DATABASE_URL_TEST: testUrl.toString(),
  SEED_ADMIN_PASSWORD: randomBytes(18).toString("base64url"),
};

const toAdd = Object.entries(derived).filter(([key]) => !existingKeys.has(key));
if (toAdd.length === 0) {
  console.log("[db:env] .env มีค่าครบแล้ว ไม่มีการเปลี่ยนแปลง");
  process.exit(0);
}

const block = [
  "",
  "# Local PostgreSQL (Docker) — สร้างโดย scripts/setup-local-db-env.mjs - SENSITIVE",
  ...toAdd.map(([key, value]) => `${key}="${value}"`),
  "",
].join("\n");

appendFileSync(ENV_PATH, (content.endsWith("\n") ? "" : "\n") + block);
console.log(`[db:env] เพิ่มคีย์ใน .env: ${toAdd.map(([key]) => key).join(", ")}`);
