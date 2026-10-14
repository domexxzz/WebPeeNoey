import type { PrismaClient } from "@prisma/client";
import { formatDateTime } from "@/lib/format";
import { markAdminNotified } from "@/lib/orders/submit-slip";
import { buildNewSlipMessage } from "@/lib/orders/slip-notification";
import { sendAdminTelegram, type TelegramFailure, type TelegramWebhookInfo } from "@/lib/notify/telegram";
import { JOB_NAMES, runJob, type AdminAlert, type JobOutcome } from "./job-run";
import { checkBrokerClaimQueue, renotifyBrokerClaims } from "@/lib/broker-ib/watchdog-checks";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export const WATCHDOG_RULES = {
  /** งานตรวจวันหมดอายุรันวันละครั้ง — เผื่อเวลาคลาดเคลื่อนของตัวตั้งเวลา 2 ชั่วโมง */
  expiryJobMaxAgeHours: 26,
  stuckJobMinutes: 30,
  slipNotifyGraceMinutes: 2,
  slipRetryLimit: 20,
  reviewOverdueHours: 24,
  deprovisionOverdueHours: 24,
  webhookErrorWindowMinutes: 60,
  webhookBacklogLimit: 100,
  /** ปัญหาชุดเดิมแจ้งซ้ำได้ทุก 6 ชั่วโมง (กันสแปมกลุ่มแอดมินจาก Watchdog รายชั่วโมง) */
  alertRepeatHours: 6,
} as const;

export interface WatchdogProblem {
  key: string;
  message: string;
}

export type WebhookCheck = () => Promise<{ ok: true; info: TelegramWebhookInfo } | { ok: false; reason: TelegramFailure }>;

export interface WatchdogDeps {
  siteUrl: string;
  now?: Date;
  alert?: AdminAlert;
  /** ตรวจ webhook ของบอทเฉพาะเมื่อเปิดใช้บอทสมาชิกแล้ว (null = ข้าม) */
  webhookCheck?: WebhookCheck | null;
}

export type WatchdogSummary = {
  healthy: boolean;
  problemKeys: string[];
  problems: string[];
  slipsRenotified: number;
  slipsRenotifyFailed: number;
  alerted: boolean;
  /** ปัญหาชุดนี้แจ้งแอดมินไปแล้วภายใน 6 ชม. (จึงไม่แจ้งซ้ำ) */
  throttled: boolean;
  /** แอดมินรับรู้ปัญหาปัจจุบันแล้ว (แจ้งสำเร็จหรือเพิ่งแจ้งไป) — false = ช่องทางแจ้งเตือนของแอปเองใช้ไม่ได้ */
  adminNotified: boolean;
  recovered: boolean;
};

async function checkJobs(db: PrismaClient, now: Date, runId: string): Promise<WatchdogProblem[]> {
  const problems: WatchdogProblem[] = [];
  const lastSuccess = await db.jobRun.findFirst({
    where: { job: JOB_NAMES.CHECK_EXPIRY, status: "SUCCESS" },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  const ageHours = lastSuccess ? (now.getTime() - lastSuccess.startedAt.getTime()) / HOUR_MS : Infinity;
  if (ageHours > WATCHDOG_RULES.expiryJobMaxAgeHours) {
    problems.push({
      key: "check-expiry-stale",
      message: lastSuccess
        ? `งานตรวจวันหมดอายุไม่สำเร็จมา ${Math.floor(ageHours)} ชั่วโมง (สำเร็จล่าสุด ${formatDateTime(lastSuccess.startedAt)}) — สมาชิกที่หมดอายุจะไม่ถูกปิดสิทธิ์`
        : "งานตรวจวันหมดอายุยังไม่เคยรันสำเร็จ — สมาชิกที่หมดอายุจะไม่ถูกปิดสิทธิ์",
    });
  }
  // งานที่ค้าง RUNNING นานเกินไปถูกตัดกลางคัน (เช่น serverless timeout) → ปิดเป็น FAILED แล้วแจ้งครั้งเดียว
  const stuck = await db.jobRun.updateMany({
    where: { status: "RUNNING", id: { not: runId }, startedAt: { lt: new Date(now.getTime() - WATCHDOG_RULES.stuckJobMinutes * MINUTE_MS) } },
    data: { status: "FAILED", finishedAt: now, error: `ค้างสถานะ RUNNING เกิน ${WATCHDOG_RULES.stuckJobMinutes} นาที (ถูกตัดกลางคัน) — Watchdog ปิดให้` },
  });
  if (stuck.count > 0) {
    problems.push({ key: "job-stuck", message: `มีงานอัตโนมัติถูกตัดกลางคัน ${stuck.count} รายการ (ค้าง RUNNING เกิน ${WATCHDOG_RULES.stuckJobMinutes} นาที) — งานรอบถัดไปจะทำต่อ` });
  }

  // สรุปรายชื่อที่ต้องถอดสิทธิ์จากงานรอบล่าสุดส่งเข้ากลุ่มแอดมินไม่สำเร็จ → รายชื่อนั้นจะไม่ถูกส่งซ้ำอีก ต้องเตือน
  const lastExpiry = await db.jobRun.findFirst({ where: { job: JOB_NAMES.CHECK_EXPIRY, status: "SUCCESS" }, orderBy: { startedAt: "desc" }, select: { summary: true } });
  if ((lastExpiry?.summary as { summaryDelivered?: boolean | null } | null)?.summaryDelivered === false) {
    problems.push({ key: "expiry-summary-undelivered", message: "สรุปงานตรวจวันหมดอายุรอบล่าสุดส่งเข้ากลุ่มแอดมินไม่สำเร็จ — ดูรายชื่อที่ต้องถอดสิทธิ์ในหน้าสถานะระบบ" });
  }
  return problems;
}

/** สิทธิ์ที่หมดอายุ/ถูกปิดแล้ว แต่ช่องทางยังบันทึกว่าเปิดอยู่เกิน 24 ชม. → สมาชิกที่ไม่ได้จ่ายยังใช้ของได้ */
async function checkDeprovisionQueue(db: PrismaClient, now: Date): Promise<WatchdogProblem[]> {
  const overdue = await db.subscription.count({
    where: {
      status: { in: ["EXPIRED", "REVOKED"] },
      updatedAt: { lt: new Date(now.getTime() - WATCHDOG_RULES.deprovisionOverdueHours * HOUR_MS) },
      OR: [{ tradingViewGranted: true }, { discordRoleGranted: true }, { telegramGranted: true }],
    },
  });
  return overdue > 0
    ? [{ key: "deprovision-overdue", message: `มีสิทธิ์ที่หมดอายุ/ถูกปิดแล้วแต่ยังไม่ได้ถอดในช่องทางเกิน ${WATCHDOG_RULES.deprovisionOverdueHours} ชั่วโมง ${overdue} รายการ` }]
    : [];
}

/** สลิปที่แจ้งกลุ่มแอดมินไม่สำเร็จตอนลูกค้าแนบ → ส่งซ้ำ (หยุดที่ความล้มเหลวแรก ไม่ยิง Telegram ซ้ำ ๆ ตอนล่ม) */
async function renotifySlips(db: PrismaClient, { now, siteUrl, alert }: { now: Date; siteUrl: string; alert: AdminAlert }) {
  const pending = await db.order.findMany({
    where: {
      status: "SLIP_SUBMITTED",
      adminNotifiedAt: null,
      slipUploadedAt: { lte: new Date(now.getTime() - WATCHDOG_RULES.slipNotifyGraceMinutes * MINUTE_MS) },
    },
    orderBy: { slipUploadedAt: "asc" },
    take: WATCHDOG_RULES.slipRetryLimit,
    select: { id: true, orderNumber: true, amount: true, plan: { select: { name: true } } },
  });
  let sent = 0;
  for (const order of pending) {
    const result = await alert(
      buildNewSlipMessage({ orderId: order.id, orderNumber: order.orderNumber, planName: order.plan.name, amount: order.amount.toNumber() }, siteUrl, { retry: true }),
    );
    if (!result.ok) break;
    await markAdminNotified(db, { orderId: order.id, now });
    sent += 1;
  }
  return { sent, failed: pending.length - sent };
}

async function checkReviewQueue(db: PrismaClient, now: Date): Promise<WatchdogProblem[]> {
  const overdue = await db.order.count({
    where: { status: "SLIP_SUBMITTED", slipUploadedAt: { lt: new Date(now.getTime() - WATCHDOG_RULES.reviewOverdueHours * HOUR_MS) } },
  });
  return overdue > 0
    ? [{ key: "review-overdue", message: `มีสลิปรอตรวจเกิน ${WATCHDOG_RULES.reviewOverdueHours} ชั่วโมง ${overdue} รายการ — ลูกค้ากำลังรอสิทธิ์` }]
    : [];
}

async function checkWebhook(webhookCheck: WebhookCheck, now: Date): Promise<WatchdogProblem[]> {
  const result = await webhookCheck();
  if (!result.ok) {
    return [{ key: "telegram-webhook-unreachable", message: `ตรวจสถานะบอท Telegram ไม่ได้ (${result.reason})` }];
  }
  const { info } = result;
  const problems: WatchdogProblem[] = [];
  if (!info.url) problems.push({ key: "telegram-webhook-missing", message: "บอท Telegram ยังไม่ได้ลงทะเบียน webhook — รัน npm run telegram:webhook" });
  if (info.lastErrorDate && now.getTime() - info.lastErrorDate.getTime() < WATCHDOG_RULES.webhookErrorWindowMinutes * MINUTE_MS) {
    problems.push({ key: "telegram-webhook-error", message: `Telegram ส่งข้อความเข้าเว็บไม่สำเร็จ: ${(info.lastErrorMessage ?? "ไม่ทราบสาเหตุ").slice(0, 200)}` });
  }
  if (info.pendingUpdateCount > WATCHDOG_RULES.webhookBacklogLimit) {
    problems.push({ key: "telegram-webhook-backlog", message: `ข้อความถึงบอทค้างอยู่ ${info.pendingUpdateCount} รายการ` });
  }
  return problems;
}

/** ตรวจทุกอย่างที่ต้องทำงานเองเบื้องหลัง — คืนรายการปัญหา (ไม่แจ้งเตือนเอง) */
export async function inspectSystem(
  db: PrismaClient,
  { now, siteUrl, alert, webhookCheck, runId }: Required<Pick<WatchdogDeps, "now" | "siteUrl" | "alert">> & Pick<WatchdogDeps, "webhookCheck"> & { runId: string },
) {
  const problems = [
    ...(await checkJobs(db, now, runId)),
    ...(await checkReviewQueue(db, now)),
    ...(await checkBrokerClaimQueue(db, now)),
    ...(await checkDeprovisionQueue(db, now)),
  ];
  const slips = await renotifySlips(db, { now, siteUrl, alert });
  if (slips.failed > 0) {
    problems.push({ key: "slip-notify-failed", message: `แจ้งสลิปใหม่เข้ากลุ่มแอดมินไม่สำเร็จ ${slips.failed} รายการ — เปิดดูที่ ${siteUrl}/admin/orders` });
  }
  const claims = await renotifyBrokerClaims(db, { now, siteUrl, alert });
  if (claims.failed > 0) {
    problems.push({ key: "broker-claim-notify-failed", message: `แจ้งคำขอสิทธิ์ผ่าน IB เข้ากลุ่มแอดมินไม่สำเร็จ ${claims.failed} รายการ — เปิดดูที่ ${siteUrl}/admin/broker-claims` });
  }
  if (webhookCheck) problems.push(...(await checkWebhook(webhookCheck, now)));
  return { problems, slips };
}

const sameKeys = (a: string[], b: string[]) => a.length === b.length && a.every((key, index) => key === b[index]);

/** Watchdog รายชั่วโมง: ตรวจ → ซ่อมเองได้ก็ซ่อม (ส่งแจ้งสลิปซ้ำ) → แจ้งแอดมินเมื่อมีปัญหาใหม่หรือกลับมาปกติ */
export async function runWatchdog(db: PrismaClient, deps: WatchdogDeps): Promise<JobOutcome<WatchdogSummary>> {
  const now = deps.now ?? new Date();
  const alert = deps.alert ?? sendAdminTelegram;

  return runJob(
    db,
    JOB_NAMES.WATCHDOG,
    async ({ runId }) => {
      const { problems, slips } = await inspectSystem(db, { now, siteUrl: deps.siteUrl, alert, webhookCheck: deps.webhookCheck, runId });
      const problemKeys = problems.map((problem) => problem.key).sort();

      const others = { job: JOB_NAMES.WATCHDOG, status: "SUCCESS" as const, id: { not: runId } };
      // รอบก่อนหน้า (ใช้ดูว่า "กลับมาปกติ") และรอบล่าสุดที่แจ้งเตือนจริง (ใช้กันแจ้งปัญหาชุดเดิมซ้ำ)
      const [previous, lastAlert] = await Promise.all([
        db.jobRun.findFirst({ where: others, orderBy: { startedAt: "desc" }, select: { summary: true } }),
        db.jobRun.findFirst({ where: { ...others, alertedAt: { not: null } }, orderBy: { alertedAt: "desc" }, select: { summary: true, alertedAt: true } }),
      ]);
      const keysOf = (summary: unknown) => (summary as { problemKeys?: string[] } | null)?.problemKeys ?? [];
      const recentlyAlerted =
        lastAlert?.alertedAt != null &&
        now.getTime() - lastAlert.alertedAt.getTime() < WATCHDOG_RULES.alertRepeatHours * HOUR_MS &&
        sameKeys(keysOf(lastAlert.summary), problemKeys);
      const recovered = problems.length === 0 && keysOf(previous?.summary).length > 0;

      let alerted = false;
      if (problems.length > 0 && !recentlyAlerted) {
        alerted = (await alert(["🩺 Watchdog พบปัญหา", ...problems.map((problem) => `• ${problem.message}`)].join("\n"))).ok;
      } else if (recovered) {
        alerted = (await alert("✅ Watchdog: ระบบกลับมาทำงานปกติแล้ว")).ok;
      }
      if (alerted) await db.jobRun.update({ where: { id: runId }, data: { alertedAt: now } });

      return {
        healthy: problems.length === 0,
        problemKeys,
        problems: problems.map((problem) => problem.message),
        slipsRenotified: slips.sent,
        slipsRenotifyFailed: slips.failed,
        alerted,
        throttled: recentlyAlerted,
        adminNotified: problems.length === 0 || alerted || recentlyAlerted,
        recovered,
      };
    },
    { alert },
  );
}
