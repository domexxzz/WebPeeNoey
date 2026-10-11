/**
 * ส่งข้อความแจ้งเตือนเข้ากลุ่ม Telegram ของแอดมิน
 * ไม่ throw — คืนผลลัพธ์ให้ผู้เรียกตัดสินใจ แต่ทุกความล้มเหลวจะถูก log เสมอ (CLAUDE.md ข้อ 5: ห้ามล้มเงียบ)
 * ส่งเป็นข้อความธรรมดา (ไม่ใช้ parse_mode) เพื่อกันการแทรก HTML/Markdown จากข้อมูลผู้ใช้
 */

export type TelegramResult = { ok: true } | { ok: false; reason: "NOT_CONFIGURED" | "HTTP_ERROR" | "NETWORK_ERROR" };

interface TelegramOptions {
  env?: Partial<Record<"TELEGRAM_BOT_TOKEN" | "TELEGRAM_ADMIN_CHAT_ID", string>>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;

export async function sendAdminTelegram(text: string, options: TelegramOptions = {}): Promise<TelegramResult> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token || !chatId) {
    console.error("[notify:telegram] ไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID — ข้อความแจ้งเตือนไม่ถูกส่ง:", text);
    return { ok: false, reason: "NOT_CONFIGURED" };
  }

  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`[notify:telegram] Telegram ตอบกลับ HTTP ${response.status}`);
      return { ok: false, reason: "HTTP_ERROR" };
    }
    return { ok: true };
  } catch (error) {
    console.error("[notify:telegram] ส่งข้อความไม่สำเร็จ:", error instanceof Error ? error.message : error);
    return { ok: false, reason: "NETWORK_ERROR" };
  }
}
