/**
 * ลงทะเบียน webhook ของบอทสมาชิก (รัน: npm run telegram:webhook [-- --info | --delete])
 * ใช้ค่าจาก .env หรือตัวแปรสภาพแวดล้อม: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL (ต้องเป็น https)
 * ไม่พิมพ์ token หรือ secret ออกหน้าจอ (CLAUDE.md ข้อ 4)
 */
import { existsSync, readFileSync } from "node:fs";

function readEnv() {
  const values = { ...process.env };
  if (existsSync(".env")) {
    for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
      if (match && !values[match[1]]) values[match[1]] = match[2];
    }
  }
  return values;
}

function fail(message) {
  console.error(`[telegram:webhook] ${message}`);
  process.exit(1);
}

const env = readEnv();
const token = env.TELEGRAM_BOT_TOKEN;
if (!token) fail("ไม่พบ TELEGRAM_BOT_TOKEN");

async function call(method, payload = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) fail(`${method} ไม่สำเร็จ: HTTP ${response.status} ${body.description ?? ""}`);
  return body.result;
}

const mode = process.argv[2];
if (mode === "--delete") {
  await call("deleteWebhook", { drop_pending_updates: false });
  console.log("[telegram:webhook] ลบ webhook แล้ว");
} else if (mode !== "--info") {
  const appUrl = (env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const secret = env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (!appUrl.startsWith("https://")) fail("NEXT_PUBLIC_APP_URL ต้องเป็น https:// (Telegram ไม่ส่ง webhook ไป http)");
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret)) fail("TELEGRAM_WEBHOOK_SECRET ต้องเป็น A-Z a-z 0-9 _ - ยาว 32–256 ตัว");
  await call("setWebhook", {
    url: `${appUrl}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: true,
    max_connections: 10,
  });
  await call("setMyCommands", {
    commands: [
      { command: "status", description: "ดูสถานะสมาชิก" },
      { command: "stop", description: "ยกเลิกการเชื่อมต่อ" },
    ],
  });
  console.log(`[telegram:webhook] ลงทะเบียน webhook แล้ว → ${appUrl}/api/telegram/webhook`);
}

const info = await call("getWebhookInfo");
console.log(
  `[telegram:webhook] url: ${info.url || "(ไม่มี)"} | ค้าง: ${info.pending_update_count ?? 0}` +
    (info.last_error_date ? ` | error ล่าสุด: ${new Date(info.last_error_date * 1000).toISOString()} ${info.last_error_message ?? ""}` : ""),
);
