/**
 * ติดตั้งและตั้งค่า PostgreSQL 16 บน Windows โดยไม่ใช้ Docker (รัน: npm run db:install)
 * ใช้เมื่อ Docker Desktop เปิดไม่ได้ เช่น หน่วยความจำเครื่องไม่พอ
 *
 * 1. ติดตั้ง PostgreSQL ผ่าน winget แบบ unattended (ต้องกดยืนยัน UAC 1 ครั้ง)
 * 2. สร้าง role และฐานข้อมูล <POSTGRES_DB> + <POSTGRES_DB>_test ตามค่าใน .env (จาก npm run db:env)
 *
 * ไม่พิมพ์ค่าความลับออกหน้าจอ และส่งคำสั่ง SQL ผ่าน stdin เท่านั้น (CLAUDE.md ข้อ 4)
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const ENV_PATH = ".env";
const PG_BIN = "C:\\Program Files\\PostgreSQL\\16\\bin";
const PSQL = `${PG_BIN}\\psql.exe`;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

function fail(message) {
  console.error(`[db:install] ${message}`);
  process.exit(1);
}

function readEnv() {
  if (!existsSync(ENV_PATH)) fail("ไม่พบไฟล์ .env");
  const values = {};
  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

const sqlLiteral = (value) => `'${value.replace(/'/g, "''")}'`;
const sqlIdentifier = (value) => `"${value}"`;

function runPsql(superPassword, sql, database = "postgres") {
  const result = spawnSync(PSQL, ["-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-U", "postgres", "-d", database, "-tA", "-f", "-"], {
    input: sql,
    encoding: "utf8",
    env: { ...process.env, PGPASSWORD: superPassword },
  });
  if (result.status !== 0) fail(`psql ล้มเหลว: ${(result.stderr || "").split("\n")[0]}`);
  return result.stdout.trim();
}

function ensureSuperPassword(env, user, password) {
  // ถ้า DATABASE_URL ใช้ user "postgres" อยู่แล้ว ให้ superuser ใช้รหัสผ่านเดียวกัน
  if (user === "postgres") return password;
  if (env.PG_SUPERUSER_PASSWORD) return env.PG_SUPERUSER_PASSWORD;
  const generated = randomBytes(18).toString("base64url");
  appendFileSync(ENV_PATH, `\n# PostgreSQL superuser (ติดตั้งด้วย scripts/setup-local-postgres.mjs) - SENSITIVE\nPG_SUPERUSER_PASSWORD="${generated}"\n`);
  console.log("[db:install] เพิ่ม PG_SUPERUSER_PASSWORD ใน .env");
  return generated;
}

function installPostgres(superPassword) {
  if (existsSync(PSQL)) {
    console.log("[db:install] พบ PostgreSQL 16 ติดตั้งอยู่แล้ว ข้ามขั้นตอนติดตั้ง");
    return;
  }
  console.log("[db:install] กำลังติดตั้ง PostgreSQL 16 ผ่าน winget (กดยืนยัน UAC เมื่อมีหน้าต่างขึ้น)...");
  // installer รับรหัสผ่านทาง command line ซึ่ง winget อาจบันทึกลง log —
  // จึงใช้รหัสชั่วคราวตอนติดตั้ง แล้วเปลี่ยนเป็นรหัสจริงผ่าน stdin ทันทีหลังติดตั้งเสร็จ
  const temporaryPassword = randomBytes(18).toString("base64url");
  const installerArgs = [
    "--mode unattended",
    "--unattendedmodeui none",
    `--superpassword ${temporaryPassword}`,
    "--serverport 5432",
    "--disable-components pgAdmin,stackbuilder",
  ].join(" ");
  const result = spawnSync(
    "winget",
    ["install", "--id", "PostgreSQL.PostgreSQL.16", "--exact", "--silent", "--accept-package-agreements", "--accept-source-agreements", "--override", installerArgs],
    { stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" },
  );
  if (result.status !== 0 || !existsSync(PSQL)) fail(`ติดตั้งไม่สำเร็จ (exit ${result.status})`);
  runPsql(temporaryPassword, `ALTER ROLE postgres WITH PASSWORD ${sqlLiteral(superPassword)};`);
  console.log("[db:install] ติดตั้งเสร็จ และเปลี่ยนรหัส superuser จากรหัสชั่วคราวแล้ว");
}

function createRoleAndDatabases(superPassword, user, password, database) {
  if (user !== "postgres") {
    runPsql(
      superPassword,
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = ${sqlLiteral(user)}) THEN
           CREATE ROLE ${sqlIdentifier(user)} LOGIN CREATEDB PASSWORD ${sqlLiteral(password)};
         ELSE
           ALTER ROLE ${sqlIdentifier(user)} WITH LOGIN CREATEDB PASSWORD ${sqlLiteral(password)};
         END IF;
       END $$;`,
    );
    console.log("[db:install] role พร้อม (LOGIN, CREATEDB สำหรับ shadow database ของ prisma migrate)");
  }

  for (const name of [database, `${database}_test`]) {
    const exists = runPsql(superPassword, `SELECT 1 FROM pg_database WHERE datname = ${sqlLiteral(name)};`);
    if (exists === "1") {
      console.log(`[db:install] ฐานข้อมูล ${name} มีอยู่แล้ว`);
      continue;
    }
    runPsql(superPassword, `CREATE DATABASE ${sqlIdentifier(name)} OWNER ${sqlIdentifier(user)};`);
    console.log(`[db:install] สร้างฐานข้อมูล ${name}`);
  }
}

const env = readEnv();
const { POSTGRES_USER: user, POSTGRES_PASSWORD: password, POSTGRES_DB: database } = env;
if (!user || !password || !database) fail("ไม่พบ POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB ใน .env (รัน npm run db:env ก่อน)");
if (!IDENTIFIER.test(user) || !IDENTIFIER.test(database)) fail("POSTGRES_USER และ POSTGRES_DB ต้องเป็นตัวอักษร ตัวเลข หรือ _ เท่านั้น");

const superPassword = ensureSuperPassword(env, user, password);
installPostgres(superPassword);
createRoleAndDatabases(superPassword, user, password, database);
console.log("[db:install] เสร็จสิ้น — ต่อด้วย npm run db:migrate และ npm run db:seed");
