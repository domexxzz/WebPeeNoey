import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/config/site";
import { checkRateLimit } from "@/lib/rate-limit";
import { isAuthorizedTelegramWebhook } from "@/lib/request-auth";
import { sendAdminTelegram, sendTelegramMessage } from "@/lib/notify/telegram";
import { handleTelegramUpdate } from "@/lib/telegram/bot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 64 * 1024;
const CHAT_MESSAGE_LIMIT = 20;
const CHAT_WINDOW_SECONDS = 60;

/** ตอบ 200 เสมอเมื่อยืนยันตัวตนผ่าน — ถ้าตอบ error Telegram จะส่งข้อความเดิมซ้ำไม่หยุด */
const accepted = () => NextResponse.json({ ok: true });

export async function POST(request: Request) {
  if (!isAuthorizedTelegramWebhook(request.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // ตรวจขนาดจาก header ก่อนอ่าน body (กันการส่ง body ใหญ่มากมาเปลืองหน่วยความจำ) แล้วตรวจซ้ำหลังอ่าน
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return accepted();
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return accepted();
  let update: unknown;
  try {
    update = JSON.parse(raw);
  } catch {
    return accepted();
  }

  try {
    await handleTelegramUpdate(prisma, update, {
      siteUrl: siteConfig.url,
      reply: (chatId, text) => sendTelegramMessage(chatId, text),
      allowChat: async (chatId) => (await checkRateLimit(`telegram-chat:${chatId}`, CHAT_MESSAGE_LIMIT, CHAT_WINDOW_SECONDS)).success,
    });
  } catch (error) {
    // ห้ามล้มเงียบ: log + แจ้งแอดมิน แต่ยังตอบ 200 (สมาชิกส่งคำสั่งใหม่ได้เอง)
    console.error("[telegram:webhook] จัดการข้อความไม่สำเร็จ", { error });
    await sendAdminTelegram("⚠️ บอท Telegram: จัดการข้อความจากสมาชิกไม่สำเร็จ (UNEXPECTED) — ดู log ของเซิร์ฟเวอร์");
  }
  return accepted();
}
