import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/config/site";
import { isAuthorizedCronRequest } from "@/lib/request-auth";
import { runExpiryJob } from "@/lib/jobs/expiry";
import { createReminderSender } from "@/lib/jobs/reminder-sender";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

/** งานประจำวัน 09:00 น. (Flow 6) — ตอบเฉพาะตัวเลขสรุป ไม่ส่งข้อมูลสมาชิกออกไป */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: NO_STORE });
  }
  const now = new Date();
  const outcome = await runExpiryJob(prisma, { now, siteUrl: siteConfig.url, sendReminder: createReminderSender({ siteUrl: siteConfig.url, now }) });
  if (!outcome.ok) {
    return NextResponse.json({ ok: false, runId: outcome.runId }, { status: 500, headers: NO_STORE });
  }
  const { summary } = outcome;
  return NextResponse.json(
    {
      ok: true,
      runId: outcome.runId,
      expiredOrders: summary.expiredOrders,
      expiredMembers: summary.expiredMembers,
      continuingMembers: summary.continuingMembers,
      pendingDeprovision: summary.pendingDeprovisionUserIds.length,
      reminded: summary.reminded,
      reminderFailed: summary.reminderFailedUserIds.length,
      hasMore: summary.hasMore,
    },
    { headers: NO_STORE },
  );
}
