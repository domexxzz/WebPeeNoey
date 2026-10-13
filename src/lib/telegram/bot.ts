import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { formatDate, daysUntil } from "@/lib/format";
import { getMembershipSummary } from "@/lib/admin/membership";
import { siteConfig } from "@/config/site";
import { linkTelegramChat, unlinkTelegramChat } from "./link";

/** รับเฉพาะส่วนที่ใช้ของ Update จาก Telegram (ส่วนอื่นปล่อยผ่าน) */
const updateSchema = z
  .object({
    update_id: z.number(),
    message: z
      .object({
        text: z.string().max(4096).optional(),
        chat: z.object({ id: z.number(), type: z.string() }).passthrough(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type BotAction = "linked" | "link_failed" | "status" | "unlinked" | "help" | "ignored" | "rate_limited";
export type BotReply = (chatId: string, text: string) => Promise<unknown>;

export interface BotDeps {
  siteUrl: string;
  reply: BotReply;
  now?: Date;
  /** คืน false เมื่อแชตนี้ส่งข้อความถี่เกินกำหนด */
  allowChat?: (chatId: string) => Promise<boolean>;
}

const COMMANDS_HELP = ["/status — ดูสถานะสมาชิก", "/stop — ยกเลิกการเชื่อมต่อ"].join("\n");

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain ?? ""}`;
}

function introText(siteUrl: string): string {
  return [`บอทแจ้งเตือนของ ${siteConfig.name}`, `เชื่อมบัญชีได้ที่ ${siteUrl}/account (กดปุ่ม "เชื่อมต่อ Telegram")`, "", COMMANDS_HELP].join("\n");
}

async function statusText(db: PrismaClient, chatId: string, siteUrl: string, now: Date): Promise<string> {
  const user = await db.user.findUnique({ where: { telegramChatId: chatId }, select: { id: true, email: true } });
  if (!user) return introText(siteUrl);
  const membership = await getMembershipSummary(db, { userId: user.id, now });
  if (!membership.active || !membership.endsAt) {
    return [`บัญชี ${maskEmail(user.email)}`, "ยังไม่มีสิทธิ์สมาชิกที่ใช้งานอยู่", `สมัคร/ต่ออายุ: ${siteUrl}/#pricing`].join("\n");
  }
  return [`บัญชี ${maskEmail(user.email)}`, `✅ สมาชิกใช้งานได้ถึง ${formatDate(membership.endsAt)} (อีก ${daysUntil(membership.endsAt, now)} วัน)`].join("\n");
}

/**
 * จัดการข้อความที่ส่งถึงบอท (ผ่าน webhook) — ตอบเฉพาะแชตส่วนตัว
 * /start <token> เชื่อมบัญชี, /status ดูสถานะ, /stop ยกเลิกการเชื่อมต่อ
 */
export async function handleTelegramUpdate(db: PrismaClient, update: unknown, deps: BotDeps): Promise<BotAction> {
  const parsed = updateSchema.safeParse(update);
  const message = parsed.success ? parsed.data.message : undefined;
  if (!message?.text || message.chat.type !== "private") return "ignored";

  const chatId = String(message.chat.id);
  if (deps.allowChat && !(await deps.allowChat(chatId))) return "rate_limited";

  const now = deps.now ?? new Date();
  const [rawCommand, argument = ""] = message.text.trim().split(/\s+/, 2);
  const command = rawCommand.toLowerCase().replace(/@\w+$/, "");

  switch (command) {
    case "/start": {
      if (!argument) {
        await deps.reply(chatId, await statusText(db, chatId, deps.siteUrl, now));
        return "status";
      }
      const result = await linkTelegramChat(db, { token: argument, chatId, now });
      if (!result.ok) {
        if (result.code === "CHAT_LINKED_ELSEWHERE") {
          await deps.reply(chatId, "แชตนี้เชื่อมกับบัญชีอื่นอยู่แล้ว — ถ้าต้องการเปลี่ยนบัญชี พิมพ์ /stop ก่อน แล้วกดลิงก์เชื่อมต่ออีกครั้ง");
          return "link_failed";
        }
        const reason = result.code === "EXPIRED_TOKEN" ? "ลิงก์เชื่อมต่อหมดอายุแล้ว" : "ลิงก์เชื่อมต่อนี้ใช้ไม่ได้หรือถูกใช้ไปแล้ว";
        await deps.reply(chatId, `${reason} — กดปุ่ม "เชื่อมต่อ Telegram" ในหน้าบัญชีอีกครั้ง: ${deps.siteUrl}/account`);
        return "link_failed";
      }
      await deps.reply(chatId, [`✅ เชื่อมต่อกับบัญชี ${maskEmail(result.email)} แล้ว`, "ระบบจะแจ้งเตือนที่นี่ก่อนสิทธิ์หมดอายุ", "", COMMANDS_HELP].join("\n"));
      return "linked";
    }
    case "/status":
      await deps.reply(chatId, await statusText(db, chatId, deps.siteUrl, now));
      return "status";
    case "/stop": {
      const unlinked = await unlinkTelegramChat(db, { chatId });
      await deps.reply(chatId, unlinked ? "ยกเลิกการเชื่อมต่อแล้ว — จะไม่ได้รับแจ้งเตือนทาง Telegram อีก" : "แชตนี้ยังไม่ได้เชื่อมกับบัญชีใด");
      return "unlinked";
    }
    default:
      await deps.reply(chatId, introText(deps.siteUrl));
      return "help";
  }
}
