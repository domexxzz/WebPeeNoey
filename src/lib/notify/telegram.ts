import { redactSensitive } from "@/lib/redact";

/**
 * เรียก Telegram Bot API — ใช้ทั้งแจ้งเตือนกลุ่มแอดมิน, ส่งข้อความถึงสมาชิก และตรวจสถานะ webhook
 * ไม่ throw — คืนผลลัพธ์ให้ผู้เรียกตัดสินใจ แต่ทุกความล้มเหลวจะถูก log เสมอ (CLAUDE.md ข้อ 5: ห้ามล้มเงียบ)
 * ส่งเป็นข้อความธรรมดา (ไม่ใช้ parse_mode) เพื่อกันการแทรก HTML/Markdown จากข้อมูลผู้ใช้
 * ห้าม log URL ของ API เพราะมี bot token อยู่ใน path
 */

export type TelegramFailure = "NOT_CONFIGURED" | "HTTP_ERROR" | "NETWORK_ERROR";
export type TelegramResult = { ok: true } | { ok: false; reason: TelegramFailure };

interface TelegramOptions {
  env?: Partial<Record<"TELEGRAM_BOT_TOKEN" | "TELEGRAM_ADMIN_CHAT_ID", string>>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** รอก่อนลองครั้งที่สอง (เทสต์ใส่ 0) */
  retryDelayMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RETRY_DELAY_MS = 1000;
/** Telegram รับข้อความยาวสุด 4096 ตัวอักษร */
const MAX_MESSAGE_LENGTH = 4000;

type CallResult = { ok: true; result: unknown } | { ok: false; reason: TelegramFailure };
type Attempt = CallResult | { ok: false; reason: TelegramFailure; retryable: boolean };

async function attemptTelegram(url: string, method: string, payload: Record<string, unknown>, options: TelegramOptions): Promise<Attempt> {
  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`[notify:telegram] ${method}: Telegram ตอบกลับ HTTP ${response.status}`);
      // 429/5xx = Telegram ไม่ว่างชั่วคราว ลองใหม่ได้ / 4xx อื่น (chat id ผิด, token ถูกเพิกถอน) ลองซ้ำก็ได้ผลเดิม
      return { ok: false, reason: "HTTP_ERROR", retryable: response.status === 429 || response.status >= 500 };
    }
    const body = (await response.json().catch(() => null)) as { result?: unknown } | null;
    return { ok: true, result: body?.result ?? null };
  } catch (error) {
    console.error(`[notify:telegram] ${method}: เรียก Telegram ไม่สำเร็จ:`, redactSensitive(error instanceof Error ? error.message : String(error)));
    return { ok: false, reason: "NETWORK_ERROR", retryable: true };
  }
}

/**
 * ลองใหม่ 1 ครั้งเมื่อพลาดแบบชั่วคราว — 25–29 ต.ค. 2569 เซิร์ฟเวอร์บน Render ต่อ Telegram ไม่ติดเป็นพัก ๆ (NETWORK_ERROR)
 * Watchdog แจ้งเองไม่ได้ GitHub เลยส่งข้อความสำรองว่าเว็บล่มทั้งที่เว็บปกติ
 * แลกกับโอกาสเล็กน้อยที่ข้อความซ้ำ (ครั้งแรกถึงแล้วแต่คำตอบหมดเวลา) — ดีกว่าแจ้งเตือนหาย
 */
async function callTelegram(method: string, payload: Record<string, unknown>, options: TelegramOptions): Promise<CallResult> {
  const env = options.env ?? process.env;
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, reason: "NOT_CONFIGURED" };

  const url = `https://api.telegram.org/bot${token}/${method}`;
  const first = await attemptTelegram(url, method, payload, options);
  if (first.ok || !("retryable" in first) || !first.retryable) return first.ok ? first : { ok: false, reason: first.reason };

  await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS));
  const second = await attemptTelegram(url, method, payload, options);
  return second.ok ? second : { ok: false, reason: second.reason };
}

function truncate(text: string): string {
  return text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH)}\n…(ตัดข้อความที่ยาวเกิน)` : text;
}

/** ส่งข้อความถึงแชตที่ระบุ (เช่น สมาชิกที่เชื่อมบัญชีกับบอทแล้ว) */
export async function sendTelegramMessage(chatId: string, text: string, options: TelegramOptions = {}): Promise<TelegramResult> {
  const result = await callTelegram("sendMessage", { chat_id: chatId, text: truncate(text), disable_web_page_preview: true }, options);
  if (!result.ok && result.reason === "NOT_CONFIGURED") {
    console.error("[notify:telegram] ไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN — ข้อความถึงสมาชิกไม่ถูกส่ง");
  }
  return result.ok ? { ok: true } : result;
}

/** ส่งข้อความแจ้งเตือนเข้ากลุ่ม Telegram ของแอดมิน */
export async function sendAdminTelegram(text: string, options: TelegramOptions = {}): Promise<TelegramResult> {
  const env = options.env ?? process.env;
  const chatId = env.TELEGRAM_ADMIN_CHAT_ID;
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) {
    // log เป็นช่องทางสำรองเมื่อยังไม่ตั้ง Telegram (ห้ามล้มเงียบ) — ปิดบังอีเมล/ความลับในข้อความก่อน
    console.error("[notify:telegram] ไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID — ข้อความแจ้งเตือนไม่ถูกส่ง:", redactSensitive(text));
    return { ok: false, reason: "NOT_CONFIGURED" };
  }
  const result = await callTelegram("sendMessage", { chat_id: chatId, text: truncate(text), disable_web_page_preview: true }, options);
  return result.ok ? { ok: true } : result;
}

export interface TelegramWebhookInfo {
  url: string;
  pendingUpdateCount: number;
  lastErrorDate: Date | null;
  lastErrorMessage: string | null;
}

/** อ่านสถานะ webhook ของบอท (Watchdog ใช้ตรวจว่าบอทยังรับข้อความได้) */
export async function getTelegramWebhookInfo(
  options: TelegramOptions = {},
): Promise<{ ok: true; info: TelegramWebhookInfo } | { ok: false; reason: TelegramFailure }> {
  const result = await callTelegram("getWebhookInfo", {}, options);
  if (!result.ok) return result;
  const raw = (result.result ?? {}) as { url?: unknown; pending_update_count?: unknown; last_error_date?: unknown; last_error_message?: unknown };
  return {
    ok: true,
    info: {
      url: typeof raw.url === "string" ? raw.url : "",
      pendingUpdateCount: typeof raw.pending_update_count === "number" ? raw.pending_update_count : 0,
      lastErrorDate: typeof raw.last_error_date === "number" ? new Date(raw.last_error_date * 1000) : null,
      lastErrorMessage: typeof raw.last_error_message === "string" ? raw.last_error_message : null,
    },
  };
}
