import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedCronRequest } from "@/lib/request-auth";
import { runSlipRecheck } from "@/lib/jobs/slip-recheck";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

/** ตรวจสลิปที่ธนาคารยังตอบไม่ได้ซ้ำ (GitHub Actions ทุก 10 นาที) — ตอบเฉพาะตัวเลขสรุป ไม่ส่งข้อมูลสลิปออกไป */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: NO_STORE });
  }
  const outcome = await runSlipRecheck(prisma);
  if ("skipped" in outcome) return NextResponse.json({ ok: true, skipped: true }, { headers: NO_STORE });
  if (!outcome.ok) return NextResponse.json({ ok: false, runId: outcome.runId }, { status: 500, headers: NO_STORE });
  return NextResponse.json({ ok: true, runId: outcome.runId, ...outcome.summary }, { headers: NO_STORE });
}
