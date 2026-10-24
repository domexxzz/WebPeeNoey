import type { JobRunStatus, PrismaClient } from "@prisma/client";
import { JOB_NAMES, type JobName } from "@/lib/jobs/job-run";
import { getPaymentAvailability, type PaymentAvailability } from "@/lib/orders/availability";
import { countPendingDeprovision, getMemberCounts } from "./dashboard";

/** ตัวแปรที่ระบบใช้ — หน้าสถานะแสดงแค่ว่าตั้งค่าแล้วหรือยัง ห้ามแสดงค่าจริง (CLAUDE.md ข้อ 4) */
export const MONITORED_ENV = [
  { key: "DATABASE_URL", required: true, purpose: "ฐานข้อมูล" },
  { key: "NEXTAUTH_SECRET", required: true, purpose: "เข้ารหัส session" },
  { key: "NEXTAUTH_URL", required: true, purpose: "URL สำหรับระบบล็อกอิน" },
  { key: "NEXT_PUBLIC_APP_URL", required: true, purpose: "URL หลักของเว็บ" },
  { key: "ADMIN_EMAIL", required: true, purpose: "อีเมลแอดมินสำหรับ seed" },
  { key: "RESEND_API_KEY", required: true, purpose: "ส่งอีเมลใบเสร็จ/แจ้งผล" },
  { key: "EMAIL_FROM", required: false, purpose: "ผู้ส่งอีเมล" },
  { key: "TELEGRAM_BOT_TOKEN", required: false, purpose: "แจ้งเตือนแอดมิน" },
  { key: "TELEGRAM_ADMIN_CHAT_ID", required: false, purpose: "กลุ่มแจ้งเตือนแอดมิน" },
  { key: "TELEGRAM_BOT_USERNAME", required: false, purpose: "ลิงก์เชื่อมบัญชีสมาชิกกับบอท" },
  { key: "TELEGRAM_WEBHOOK_SECRET", required: false, purpose: "ยืนยันว่า webhook มาจาก Telegram" },
  { key: "CRON_SECRET", required: true, purpose: "ป้องกัน Cron / Watchdog endpoint" },
  { key: "EASYSLIP_TOKEN", required: false, purpose: "ตรวจสลิปกับธนาคารอัตโนมัติ (EasySlip)" },
  { key: "SLIP_RECEIVER_ACCOUNTS", required: false, purpose: "เลขบัญชีรับเงินตามที่โชว์บนสลิป (ใช้ตรวจผู้รับ)" },
  { key: "NEXT_PUBLIC_CONTACT_EMAIL", required: false, purpose: "อีเมลติดต่อลูกค้าบนเว็บ" },
  { key: "NEXT_PUBLIC_CONTACT_LINE", required: false, purpose: "LINE ติดต่อลูกค้าบนเว็บ" },
  { key: "NEXT_PUBLIC_CONTACT_TELEGRAM", required: false, purpose: "Telegram ติดต่อลูกค้าบนเว็บ" },
  { key: "NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION", required: false, purpose: "ยืนยันเว็บกับ Google Search Console" },
  { key: "NEXT_PUBLIC_BING_SITE_VERIFICATION", required: false, purpose: "ยืนยันเว็บกับ Bing Webmaster Tools" },
  { key: "NEXT_PUBLIC_CF_ANALYTICS_TOKEN", required: false, purpose: "สถิติผู้เข้าชม (Cloudflare Web Analytics)" },
] as const;

export interface SystemHealth {
  checkedAt: Date;
  database: { ok: boolean; latencyMs: number | null };
  env: { key: string; required: boolean; purpose: string; configured: boolean }[];
  payments: PaymentAvailability;
  queues: { pendingReview: number; unnotifiedSlips: number; awaitingPayment: number; expiringSoon: number; pendingDeprovision: number };
  jobs: JobHealth[];
}

export const JOB_LABELS: Record<JobName, string> = {
  "check-expiry": "ตรวจวันหมดอายุ + เตือนก่อนหมด (ทุกวัน 09:00)",
  watchdog: "Watchdog เฝ้าระบบ (ทุกชั่วโมง)",
  "slip-recheck": "ตรวจสลิปซ้ำกับธนาคาร (ทุก 10 นาที — บันทึกเฉพาะรอบที่มีสลิปรอตรวจ)",
};

export interface JobHealth {
  job: JobName;
  label: string;
  lastRun: { status: JobRunStatus; startedAt: Date; finishedAt: Date | null; error: string | null } | null;
  lastSuccessAt: Date | null;
}

/** สถานะงานอัตโนมัติล่าสุดของแต่ละงาน (แสดงในหน้าสถานะระบบ) */
export async function getJobHealth(db: PrismaClient): Promise<JobHealth[]> {
  return Promise.all(
    Object.values(JOB_NAMES).map(async (job) => {
      const [lastRun, lastSuccess] = await Promise.all([
        db.jobRun.findFirst({ where: { job }, orderBy: { startedAt: "desc" }, select: { status: true, startedAt: true, finishedAt: true, error: true } }),
        db.jobRun.findFirst({ where: { job, status: "SUCCESS" }, orderBy: { startedAt: "desc" }, select: { startedAt: true } }),
      ]);
      return { job, label: JOB_LABELS[job], lastRun, lastSuccessAt: lastSuccess?.startedAt ?? null };
    }),
  );
}

export async function getSystemHealth(
  db: PrismaClient,
  { env = process.env, now = new Date() }: { env?: Partial<Record<string, string | undefined>>; now?: Date } = {},
): Promise<SystemHealth> {
  const started = Date.now();
  let databaseOk = true;
  try {
    await db.$queryRaw`SELECT 1`;
  } catch (error) {
    databaseOk = false;
    console.error("[health] database check failed", error);
  }
  const latencyMs = databaseOk ? Date.now() - started : null;

  const envStatus = MONITORED_ENV.map((item) => ({ ...item, configured: Boolean(env[item.key]?.trim()) }));
  if (!databaseOk) {
    return {
      checkedAt: now,
      database: { ok: false, latencyMs },
      env: envStatus,
      payments: { open: false, reason: "DISABLED" },
      queues: { pendingReview: 0, unnotifiedSlips: 0, awaitingPayment: 0, expiringSoon: 0, pendingDeprovision: 0 },
      jobs: [],
    };
  }

  const [payments, pendingReview, unnotifiedSlips, awaitingPayment, members, pendingDeprovision, jobs] = await Promise.all([
    getPaymentAvailability(db),
    db.order.count({ where: { status: "SLIP_SUBMITTED" } }),
    db.order.count({ where: { status: "SLIP_SUBMITTED", adminNotifiedAt: null } }),
    db.order.count({ where: { status: "PENDING_PAYMENT", expiresAt: { gt: now } } }),
    // นับรายคน: คนที่ต่ออายุทบวันไว้แล้วไม่ถือว่าใกล้หมด
    getMemberCounts(db, { now }),
    countPendingDeprovision(db),
    getJobHealth(db),
  ]);

  return {
    checkedAt: now,
    database: { ok: true, latencyMs },
    env: envStatus,
    payments,
    queues: { pendingReview, unnotifiedSlips, awaitingPayment, expiringSoon: members.expiringSoon, pendingDeprovision },
    jobs,
  };
}
