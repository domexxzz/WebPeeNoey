/**
 * ซ้อมกู้คืนฐานข้อมูล (docs/PLAN.md ข้อ 7) — รัน: npm run db:restore-drill
 * 1. pg_dump ฐานข้อมูลจาก DATABASE_URL (รูปแบบ custom)  2. สร้างฐานข้อมูลชั่วคราว <db>_restore_drill
 * 3. pg_restore  4. เทียบจำนวนแถวทุกตาราง + trigger ป้องกันแก้ AuditLog
 * 5. ลบฐานข้อมูลชั่วคราวและไฟล์ dump — จบด้วย exit code 1 ถ้าไม่ตรง
 * ส่งรหัสผ่านผ่านตัวแปร PGPASSWORD เท่านั้น ไม่พิมพ์ค่าความลับ (CLAUDE.md ข้อ 4)
 */
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PG_BIN = process.env.PG_BIN ?? (process.platform === "win32" ? "C:/Program Files/PostgreSQL/16/bin" : "/usr/bin");
const tool = (name) => join(PG_BIN, process.platform === "win32" ? `${name}.exe` : name);
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

class DrillFailure extends Error {}

/** throw แทน process.exit เพื่อให้ finally ลบไฟล์ dump (มีข้อมูลจริง) และฐานข้อมูลชั่วคราวเสมอ */
function fail(message) {
  throw new DrillFailure(message);
}

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!existsSync(".env")) fail("ไม่พบ .env");
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]*)"?\s*$/);
    if (match) return match[1];
  }
  return fail("ไม่พบ DATABASE_URL");
}

const url = new URL(readDatabaseUrl());
const sourceDb = decodeURIComponent(url.pathname.slice(1));
const drillDb = `${sourceDb}_restore_drill`;
if (!IDENTIFIER.test(sourceDb) || !IDENTIFIER.test(drillDb)) fail("ชื่อฐานข้อมูลไม่ถูกต้อง");
if (!LOCAL_HOSTS.includes(url.hostname)) fail("สคริปต์นี้ซ้อมกับฐานข้อมูลบนเครื่องเท่านั้น (production ใช้ Neon PITR + workflow backup)");

const pgEnv = (database) => ({
  ...process.env,
  PGHOST: url.hostname.replace(/^\[|\]$/g, ""),
  PGPORT: url.port || "5432",
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: database,
});

function run(name, args, database, input) {
  const result = spawnSync(tool(name), args, { encoding: "utf8", env: pgEnv(database), input });
  if (result.error) fail(`${name}: ${result.error.message}`);
  if (result.status !== 0) fail(`${name} ล้มเหลว: ${(result.stderr ?? "").trim().slice(0, 500)}`);
  return (result.stdout ?? "").trim();
}

const query = (database, sql) => run("psql", ["-v", "ON_ERROR_STOP=1", "-tA", "-f", "-"], database, sql);

function snapshot(database) {
  const tables = query(database, "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;").split(/\r?\n/).filter(Boolean);
  const counts = Object.fromEntries(
    tables.map((table) => {
      if (!IDENTIFIER.test(table)) fail(`ชื่อตารางไม่คาดคิด: ${table}`);
      return [table, Number(query(database, `SELECT count(*) FROM "public"."${table}";`))];
    }),
  );
  const trigger = Number(query(database, "SELECT count(*) FROM pg_trigger WHERE tgname = 'audit_log_no_update_delete';"));
  return { counts, trigger };
}

const started = Date.now();
const dumpFile = join(tmpdir(), `webpeenoey-drill-${started}.dump`);
try {
  console.log(`[db:restore-drill] 1/4 สำรอง ${sourceDb} ...`);
  run("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", `--file=${dumpFile}`], sourceDb);
  const dumpBytes = statSync(dumpFile).size;

  console.log(`[db:restore-drill] 2/4 สร้างฐานข้อมูลชั่วคราว ${drillDb} ...`);
  query("postgres", `DROP DATABASE IF EXISTS "${drillDb}";`);
  query("postgres", `CREATE DATABASE "${drillDb}";`);

  console.log("[db:restore-drill] 3/4 กู้คืนจากไฟล์สำรอง ...");
  run("pg_restore", ["--no-owner", "--no-privileges", "--exit-on-error", `--dbname=${drillDb}`, dumpFile], drillDb);
  const elapsedSeconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log("[db:restore-drill] 4/4 ตรวจเทียบข้อมูล ...");
  const source = snapshot(sourceDb);
  const restored = snapshot(drillDb);
  const tables = [...new Set([...Object.keys(source.counts), ...Object.keys(restored.counts)])].sort();
  let mismatches = 0;
  for (const table of tables) {
    const ok = source.counts[table] === restored.counts[table];
    if (!ok) mismatches += 1;
    console.log(`  ${ok ? "✓" : "✗"} ${table.padEnd(22)} ต้นทาง ${String(source.counts[table] ?? "-").padStart(6)}  กู้คืน ${String(restored.counts[table] ?? "-").padStart(6)}`);
  }
  const triggerOk = restored.trigger > 0 && restored.trigger === source.trigger;
  if (!triggerOk) mismatches += 1;
  console.log(`  ${triggerOk ? "✓" : "✗"} trigger AuditLog append-only`);
  console.log(`[db:restore-drill] ไฟล์สำรอง ${(dumpBytes / 1024).toFixed(1)} KB · สำรอง+กู้คืน ${elapsedSeconds} วินาที · ${tables.length} ตาราง`);
  if (mismatches > 0) fail(`ข้อมูลไม่ตรง ${mismatches} รายการ`);
  console.log("[db:restore-drill] ผ่าน ✅ กู้คืนได้ครบทุกตาราง");
} catch (error) {
  console.error(`[db:restore-drill] ${error instanceof DrillFailure ? error.message : error}`);
  process.exitCode = 1;
} finally {
  rmSync(dumpFile, { force: true });
  spawnSync(tool("psql"), ["-tA", "-c", `DROP DATABASE IF EXISTS "${drillDb}";`], { env: pgEnv("postgres") });
}
