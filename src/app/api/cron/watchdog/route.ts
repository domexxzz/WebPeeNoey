import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/config/site";
import { isAuthorizedCronRequest } from "@/lib/request-auth";
import { getTelegramWebhookInfo } from "@/lib/notify/telegram";
import { runWatchdog } from "@/lib/jobs/watchdog";
import { telegramDeepLink } from "@/lib/telegram/link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

/** บอทสมาชิกเปิดใช้ครบ (เงื่อนไขเดียวกับปุ่มเชื่อมต่อในหน้าบัญชี) — ไม่งั้นไม่ต้องตรวจ webhook */
function isMemberBotEnabled(): boolean {
  return Boolean(process.env.TELEGRAM_WEBHOOK_SECRET) && telegramDeepLink(process.env.TELEGRAM_BOT_USERNAME, "check") !== null;
}

/**
 * Watchdog รายชั่วโมง — ตอบ 503 เมื่อพบปัญหา พร้อม adminNotified
 * adminNotified = false (แจ้งกลุ่มแอดมินไม่สำเร็จ เช่น Telegram ล่ม/token ถูกเพิกถอน) → ตัวเรียกภายนอก (GitHub Actions) ต้องแจ้งเตือนเอง
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: NO_STORE });
  }
  const outcome = await runWatchdog(prisma, {
    siteUrl: siteConfig.url,
    webhookCheck: isMemberBotEnabled() ? () => getTelegramWebhookInfo() : null,
  });
  if (!outcome.ok) {
    return NextResponse.json({ ok: false, runId: outcome.runId }, { status: 500, headers: NO_STORE });
  }
  const { summary } = outcome;
  return NextResponse.json(
    { ok: summary.healthy, runId: outcome.runId, problems: summary.problemKeys, adminNotified: summary.adminNotified, slipsRenotified: summary.slipsRenotified },
    { status: summary.healthy ? 200 : 503, headers: NO_STORE },
  );
}
