"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { createTelegramLinkToken, telegramDeepLink, unlinkTelegramForUser } from "@/lib/telegram/link";

export type TelegramLinkState =
  | { status: "idle" }
  | { status: "ready"; url: string; expiresAt: string }
  | { status: "error"; message: string };

const LINK_ATTEMPTS = 5;
const LINK_WINDOW_SECONDS = 15 * 60;

/** สร้างลิงก์เปิดบอทพร้อมโทเคนใช้ครั้งเดียว (อายุ 15 นาที) */
export async function createTelegramLinkAction(_previous: TelegramLinkState, _formData: FormData): Promise<TelegramLinkState> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return { status: "error", message: "กรุณาเข้าสู่ระบบอีกครั้ง" };

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!telegramDeepLink(botUsername, "check")) return { status: "error", message: "การแจ้งเตือนทาง Telegram ยังไม่เปิดใช้งาน" };
  if (!(await checkRateLimit(`telegram-link:${userId}`, LINK_ATTEMPTS, LINK_WINDOW_SECONDS)).success) {
    return { status: "error", message: "ขอลิงก์บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" };
  }

  try {
    const { token, expiresAt } = await createTelegramLinkToken(prisma, { userId });
    return { status: "ready", url: telegramDeepLink(botUsername, token)!, expiresAt: expiresAt.toISOString() };
  } catch (error) {
    console.error("[account] สร้างลิงก์เชื่อม Telegram ไม่สำเร็จ", { userId, error });
    return { status: "error", message: "สร้างลิงก์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
}

export async function unlinkTelegramAction(): Promise<void> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return;
  await unlinkTelegramForUser(prisma, { userId });
  revalidatePath("/account");
}
