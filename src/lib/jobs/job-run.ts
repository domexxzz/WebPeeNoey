import type { Prisma, PrismaClient } from "@prisma/client";
import { sendAdminTelegram, type TelegramResult } from "@/lib/notify/telegram";
import { redactSensitive } from "@/lib/redact";

export const JOB_NAMES = {
  CHECK_EXPIRY: "check-expiry",
  WATCHDOG: "watchdog",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
export type AdminAlert = (text: string) => Promise<TelegramResult>;
export type JobSummary = Prisma.InputJsonObject;

export type JobOutcome<T extends JobSummary> =
  | { ok: true; runId: string; summary: T }
  | { ok: false; runId: string | null; error: string; summary: T | null };

const ERROR_MAX_LENGTH = 2000;

/** งานทำไปได้บางส่วนแต่มีรายการที่ผิดพลาด — บันทึกสรุปไว้ด้วย และถือว่ารอบนี้ล้มเหลว */
export class JobPartialFailure<T extends JobSummary> extends Error {
  constructor(message: string, readonly summary: T) {
    super(message);
    this.name = "JobPartialFailure";
  }
}

function describe(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  // ข้อความ error ของ Prisma/การเชื่อมต่ออาจมี connection string หรืออีเมล — ลบก่อนบันทึก/ส่งต่อ
  return redactSensitive(message).slice(0, ERROR_MAX_LENGTH);
}

/**
 * รันงานอัตโนมัติพร้อมบันทึก JobRun ทุกครั้ง (CLAUDE.md ข้อ 5)
 * สำเร็จ → SUCCESS + สรุปผล / ล้มเหลว → FAILED + ข้อความผิดพลาด + log + แจ้งกลุ่มแอดมินทันที
 * ไม่ throw ออกไป เพื่อให้ endpoint ตอบสถานะที่ถูกต้องได้เสมอ
 */
export async function runJob<T extends JobSummary>(
  db: PrismaClient,
  job: JobName,
  run: (context: { runId: string }) => Promise<T>,
  { alert = sendAdminTelegram }: { alert?: AdminAlert } = {},
): Promise<JobOutcome<T>> {
  let runId: string | null = null;
  try {
    runId = (await db.jobRun.create({ data: { job }, select: { id: true } })).id;
    const summary = await run({ runId });
    await db.jobRun.update({ where: { id: runId }, data: { status: "SUCCESS", finishedAt: new Date(), summary } });
    return { ok: true, runId, summary };
  } catch (error) {
    const message = describe(error);
    const summary = error instanceof JobPartialFailure ? (error.summary as T) : null;
    console.error(`[job:${job}] ล้มเหลว`, { runId, error: redactSensitive(error instanceof Error ? error.stack ?? message : message) });

    if (runId) {
      await db.jobRun
        .update({ where: { id: runId }, data: { status: "FAILED", finishedAt: new Date(), error: message, ...(summary ? { summary } : {}) } })
        .catch((updateError) => console.error(`[job:${job}] บันทึกสถานะ FAILED ไม่สำเร็จ`, { runId, updateError }));
    }
    const sent = await alert([`🚨 งานอัตโนมัติ "${job}" ล้มเหลว`, message.slice(0, 500), runId ? `Run: ${runId}` : "บันทึก JobRun ไม่ได้ (ฐานข้อมูลอาจล่ม)"].join("\n"));
    if (sent.ok && runId) {
      await db.jobRun
        .update({ where: { id: runId }, data: { alertedAt: new Date() } })
        .catch((updateError) => console.error(`[job:${job}] บันทึกเวลาแจ้งเตือนไม่สำเร็จ`, { runId, updateError }));
    }
    return { ok: false, runId, error: message, summary };
  }
}
