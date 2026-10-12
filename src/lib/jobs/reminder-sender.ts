import { sendExpiryReminderEmail } from "@/lib/email";
import { sendTelegramMessage, type TelegramResult } from "@/lib/notify/telegram";
import { daysUntil, formatDate } from "@/lib/format";
import type { SendReminder } from "./expiry";

interface ReminderSenderDeps {
  siteUrl: string;
  now?: Date;
  sendEmail?: typeof sendExpiryReminderEmail;
  sendTelegram?: (chatId: string, text: string) => Promise<TelegramResult>;
}

/** ส่งเตือนก่อนหมดอายุทางอีเมล + Telegram ส่วนตัว (ถ้าสมาชิกเชื่อมบอทไว้) — ช่องทางใดสำเร็จก็ถือว่าเตือนแล้ว */
export function createReminderSender({ siteUrl, now = new Date(), sendEmail = sendExpiryReminderEmail, sendTelegram = sendTelegramMessage }: ReminderSenderDeps): SendReminder {
  return async (target) => {
    const renewUrl = `${siteUrl}/checkout/${encodeURIComponent(target.planSlug)}`;
    const daysLeft = daysUntil(target.endsAt, now);
    const telegramText = [
      `⏰ สิทธิ์ ${target.planName} ของคุณจะหมดอายุ ${formatDate(target.endsAt)} (อีก ${daysLeft} วัน)`,
      "ต่ออายุก่อนหมด วันใช้งานจะทบต่อทันที:",
      renewUrl,
    ].join("\n");

    // allSettled: ช่องทางหนึ่ง throw ต้องไม่ทำให้อีกช่องทางที่ส่งสำเร็จแล้วถูกนับว่าล้มเหลว (ไม่งั้นพรุ่งนี้จะเตือนซ้ำ)
    const [email, telegram] = await Promise.allSettled([
      sendEmail(target.email, { planName: target.planName, endsAt: target.endsAt, daysLeft, renewUrl }),
      target.telegramChatId ? sendTelegram(target.telegramChatId, telegramText).then((result) => result.ok) : Promise.resolve(false),
    ]);
    for (const outcome of [email, telegram]) {
      if (outcome.status === "rejected") console.error("[job:check-expiry] ช่องทางส่งเตือนผิดพลาด", { userId: target.userId, error: outcome.reason });
    }
    return { email: email.status === "fulfilled" && email.value, telegram: telegram.status === "fulfilled" && telegram.value };
  };
}
