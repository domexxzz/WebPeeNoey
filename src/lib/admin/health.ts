import type { PrismaClient } from "@prisma/client";
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
  { key: "CRON_SECRET", required: false, purpose: "ป้องกัน Cron endpoint" },
] as const;

export interface SystemHealth {
  checkedAt: Date;
  database: { ok: boolean; latencyMs: number | null };
  env: { key: string; required: boolean; purpose: string; configured: boolean }[];
  payments: PaymentAvailability;
  queues: { pendingReview: number; unnotifiedSlips: number; awaitingPayment: number; expiringSoon: number; pendingDeprovision: number };
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
    };
  }

  const [payments, pendingReview, unnotifiedSlips, awaitingPayment, members, pendingDeprovision] = await Promise.all([
    getPaymentAvailability(db),
    db.order.count({ where: { status: "SLIP_SUBMITTED" } }),
    db.order.count({ where: { status: "SLIP_SUBMITTED", adminNotifiedAt: null } }),
    db.order.count({ where: { status: "PENDING_PAYMENT", expiresAt: { gt: now } } }),
    // นับรายคน: คนที่ต่ออายุทบวันไว้แล้วไม่ถือว่าใกล้หมด
    getMemberCounts(db, { now }),
    countPendingDeprovision(db),
  ]);

  return {
    checkedAt: now,
    database: { ok: true, latencyMs },
    env: envStatus,
    payments,
    queues: { pendingReview, unnotifiedSlips, awaitingPayment, expiringSoon: members.expiringSoon, pendingDeprovision },
  };
}
