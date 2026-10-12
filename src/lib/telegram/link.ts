import { createHash, randomBytes } from "crypto";
import { Prisma, type PrismaClient } from "@prisma/client";

/** อายุลิงก์เชื่อมบัญชี — สั้นพอที่ลิงก์ที่หลุดไปจะใช้ไม่ได้นาน */
export const LINK_TOKEN_TTL_MINUTES = 15;
const TOKEN_BYTES = 32;
/** base64url ของ 32 bytes = 43 ตัวอักษร (Telegram /start รับได้สูงสุด 64 ตัว [A-Za-z0-9_-]) */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const BOT_USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

export function hashLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** สร้างโทเคนใช้ครั้งเดียว (เก็บเฉพาะ hash) — โทเคนเก่าที่ยังไม่ใช้ของผู้ใช้คนนี้ถูกยกเลิก */
export async function createTelegramLinkToken(
  db: PrismaClient,
  { userId, now = new Date(), random = randomBytes }: { userId: string; now?: Date; random?: (size: number) => Buffer },
): Promise<{ token: string; expiresAt: Date }> {
  const token = random(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(now.getTime() + LINK_TOKEN_TTL_MINUTES * 60 * 1000);
  await db.$transaction([
    db.telegramLinkToken.deleteMany({ where: { userId, usedAt: null } }),
    db.telegramLinkToken.create({ data: { userId, tokenHash: hashLinkToken(token), expiresAt } }),
  ]);
  return { token, expiresAt };
}

export type LinkResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; code: "INVALID_TOKEN" | "EXPIRED_TOKEN" | "CHAT_LINKED_ELSEWHERE" };

/**
 * ผูกแชต Telegram กับบัญชีจากโทเคน — 1 แชตผูกได้ 1 บัญชี
 * แชตที่ผูกกับบัญชีอื่นอยู่จะไม่ถูกย้ายเงียบ ๆ (กันคนส่งลิงก์ของตัวเองมาให้กดเพื่อตัดการแจ้งเตือนของเรา) — ต้อง /stop ก่อน
 */
export async function linkTelegramChat(
  db: PrismaClient,
  { token, chatId, now = new Date() }: { token: string; chatId: string; now?: Date },
): Promise<LinkResult> {
  if (!TOKEN_PATTERN.test(token)) return { ok: false, code: "INVALID_TOKEN" };
  try {
    return await db.$transaction(async (tx): Promise<LinkResult> => {
      const row = await tx.telegramLinkToken.findUnique({ where: { tokenHash: hashLinkToken(token) }, select: { id: true, userId: true, expiresAt: true, usedAt: true } });
      if (!row || row.usedAt) return { ok: false, code: "INVALID_TOKEN" };
      if (row.expiresAt <= now) return { ok: false, code: "EXPIRED_TOKEN" };
      const owner = await tx.user.findUnique({ where: { telegramChatId: chatId }, select: { id: true } });
      if (owner && owner.id !== row.userId) return { ok: false, code: "CHAT_LINKED_ELSEWHERE" };
      // จองโทเคนแบบมีเงื่อนไข — ส่ง /start ซ้ำพร้อมกันจะสำเร็จแค่ครั้งเดียว
      const claimed = await tx.telegramLinkToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
      if (claimed.count === 0) return { ok: false, code: "INVALID_TOKEN" };

      const user = await tx.user.update({ where: { id: row.userId }, data: { telegramChatId: chatId, telegramLinkedAt: now }, select: { id: true, email: true } });
      return { ok: true, userId: user.id, email: user.email };
    });
  } catch (error) {
    // แชตเดียวกันถูกผูกกับอีกบัญชีพร้อมกันพอดี — ให้ผู้ใช้กดลิงก์ใหม่
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, code: "INVALID_TOKEN" };
    throw error;
  }
}

export async function unlinkTelegramChat(db: PrismaClient, { chatId }: { chatId: string }): Promise<boolean> {
  const { count } = await db.user.updateMany({ where: { telegramChatId: chatId }, data: { telegramChatId: null, telegramLinkedAt: null } });
  return count > 0;
}

export async function unlinkTelegramForUser(db: PrismaClient, { userId }: { userId: string }): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { telegramChatId: null, telegramLinkedAt: null } });
  await db.telegramLinkToken.deleteMany({ where: { userId, usedAt: null } });
}

/** ลิงก์เปิดบอทพร้อมโทเคน — null ถ้าตั้งชื่อบอทไม่ถูกต้อง */
export function telegramDeepLink(botUsername: string | undefined, token: string): string | null {
  const username = botUsername?.trim().replace(/^@/, "");
  if (!username || !BOT_USERNAME_PATTERN.test(username)) return null;
  return `https://t.me/${username}?start=${token}`;
}
