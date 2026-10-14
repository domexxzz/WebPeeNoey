import type { PrismaClient, AccessKind } from "@prisma/client";
import { PAYMENT_RULES } from "@/config/payment";
import { expireStaleOrders } from "@/lib/orders/create-order";
import { writeAudit } from "@/lib/admin/audit";
import { carryOverProvisioning, GRANT_FIELDS, type GrantField } from "@/lib/admin/membership";
import { PROVISIONING_CHANNELS } from "@/lib/admin/members";
import { sendAdminTelegram } from "@/lib/notify/telegram";
import { JOB_NAMES, JobPartialFailure, runJob, type AdminAlert, type JobOutcome } from "./job-run";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const LIVE_STATUSES = ["ACTIVE", "EXPIRING_SOON"] as const;
/** จำกัดจำนวนสมาชิกต่อรอบ — ที่เหลือทำต่อรอบถัดไป */
export const MAX_MEMBERS_PER_RUN = 300;
/** หยุดรับงานใหม่ก่อน serverless timeout (maxDuration 60 วินาที) เพื่อไม่ให้ถูกตัดกลางรายการ */
export const JOB_TIME_BUDGET_MS = 40_000;
/** การจองส่งเตือนที่ค้างนานกว่านี้ = งานรอบก่อนถูกตัดกลางคันหลังจอง → ส่งใหม่ได้ */
const REMINDER_CLAIM_STALE_MS = 30 * MINUTE_MS;
const SUMMARY_LIST_LIMIT = 20;
const SUMMARY_FIELD_MAX = 40;

const CHANNEL_LABELS = Object.fromEntries(
  Object.values(PROVISIONING_CHANNELS).map(({ field, label }) => [field, label]),
) as Record<GrantField, string>;

const outOfTime = (deadline: number) => Date.now() > deadline;

export interface ExpiredMember {
  userId: string;
  email: string;
  tradingViewUsername: string | null;
  discordUserId: string | null;
  expiredSubscriptions: number;
  /** ยังมีช่วงสิทธิ์ที่จ่ายไว้ต่อ (ต่ออายุทบวัน) — ห้ามถอดสิทธิ์ */
  continuing: boolean;
  /** ช่องทางที่ยังบันทึกว่าเปิดอยู่ และต้องถอดด้วยมือ */
  pendingChannels: GrantField[];
}

export interface ExpireResult {
  members: ExpiredMember[];
  errors: { userId: string; message: string }[];
  hasMore: boolean;
}

/** Flow 6 ขั้นที่ 2: ช่วงสิทธิ์ที่เลยวันสิ้นสุด → EXPIRED (ทำทีละคนภายใต้ lock เดียวกับการอนุมัติ/คืนเงิน) */
export async function expireSubscriptions(
  db: PrismaClient,
  { now, deadline = Number.POSITIVE_INFINITY }: { now: Date; deadline?: number },
): Promise<ExpireResult> {
  // groupBy = GROUP BY + LIMIT ใน SQL จริง (findMany + distinct ของ Prisma ตัดซ้ำในหน่วยความจำ ทำให้ take นับผิด)
  const due = await db.subscription.groupBy({
    by: ["userId"],
    where: { status: { in: [...LIVE_STATUSES] }, currentPeriodEnd: { lte: now } },
    orderBy: { userId: "asc" },
    take: MAX_MEMBERS_PER_RUN + 1,
  });
  const result: ExpireResult = { members: [], errors: [], hasMore: due.length > MAX_MEMBERS_PER_RUN };

  for (const { userId } of due.slice(0, MAX_MEMBERS_PER_RUN)) {
    if (outOfTime(deadline)) {
      result.hasMore = true;
      break;
    }
    try {
      const member = await expireMember(db, userId, now);
      if (member) result.members.push(member);
    } catch (error) {
      // คนหนึ่งผิดพลาดต้องไม่หยุดคนอื่น — รวบรวมไว้แล้วให้รอบนี้ถือว่าล้มเหลว (แจ้งแอดมิน)
      console.error("[job:check-expiry] ทำให้สิทธิ์หมดอายุไม่สำเร็จ", { userId, error });
      result.errors.push({ userId, message: error instanceof Error ? error.message.slice(0, 300) : String(error) });
    }
  }
  return result;
}

async function expireMember(db: PrismaClient, userId: string, now: Date): Promise<ExpiredMember | null> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`membership:${userId}`}))`;
    // อ่านใหม่หลังได้ lock — อีกรอบที่รันซ้อนกันอาจทำไปแล้ว
    const ended = await tx.subscription.findMany({
      where: { userId, status: { in: [...LIVE_STATUSES] }, currentPeriodEnd: { lte: now } },
      select: { id: true },
    });
    if (ended.length === 0) return null;
    const endedIds = ended.map((segment) => segment.id);

    await tx.subscription.updateMany({ where: { id: { in: endedIds } }, data: { status: "EXPIRED" } });
    const carried = await carryOverProvisioning(tx, { userId, fromIds: endedIds, now });
    const continuing =
      (await tx.subscription.count({
        where: { userId, status: { in: [...LIVE_STATUSES] }, currentPeriodStart: { lte: now }, currentPeriodEnd: { gt: now } },
      })) > 0;
    const stillGranted = await tx.subscription.findMany({
      where: { id: { in: endedIds } },
      select: { tradingViewGranted: true, discordRoleGranted: true, telegramGranted: true },
    });
    const pendingChannels = GRANT_FIELDS.filter((field) => stillGranted.some((segment) => segment[field]));
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, tradingViewUsername: true, discordUserId: true },
    });

    await writeAudit(tx, {
      actor: null,
      action: "SUBSCRIPTION_EXPIRE",
      targetType: "User",
      targetId: userId,
      details: { subscriptions: endedIds, continuing, pendingChannels, expiredAt: now.toISOString() },
    });
    if (carried) {
      await writeAudit(tx, {
        actor: null,
        action: "PROVISIONING_CARRY_OVER",
        targetType: "Subscription",
        targetId: carried.toSubscriptionId,
        details: { from: endedIds, channels: carried.channels },
      });
    }
    return { userId, ...user, expiredSubscriptions: endedIds.length, continuing, pendingChannels };
  });
}

export interface ReminderTarget {
  userId: string;
  email: string;
  telegramChatId: string | null;
  planName: string;
  planSlug: string;
  /** BROKER_IB = สิทธิ์ฟรีผ่าน IB — ต่ออายุด้วยการยื่นคำขอใหม่ ไม่ใช่หน้าชำระเงิน */
  planKind?: AccessKind;
  endsAt: Date;
}

export type ReminderDelivery = { email: boolean; telegram: boolean };
export type SendReminder = (target: ReminderTarget) => Promise<ReminderDelivery>;

export interface ReminderResult {
  reminded: number;
  failed: { userId: string; email: string }[];
  hasMore: boolean;
}

/**
 * Flow 6 ขั้นที่ 1: เตือนสมาชิกที่สิทธิ์ "รวมทุกช่วงที่ต่อกัน" จะหมดภายใน N วัน (คนที่ต่ออายุเกินช่วงนั้นไว้แล้วไม่ถูกเตือน)
 * 1. จองช่วงสุดท้ายแบบมีเงื่อนไข (claimedAt) — รันซ้อนกันก็เตือนครั้งเดียว
 * 2. ส่งสำเร็จ → บันทึก sentAt (ไม่ถูกเลือกอีก) / ส่งไม่ได้ทุกช่องทาง → ปล่อยการจองให้รอบหน้าลองใหม่
 * 3. ถูกตัดกลางคันหลังจอง → การจองค้างเกิน 30 นาทีถูกส่งใหม่ได้ (ไม่หายเงียบ)
 */
export async function sendExpiryReminders(
  db: PrismaClient,
  {
    now,
    send,
    withinDays = PAYMENT_RULES.expiryReminderDays,
    deadline = Number.POSITIVE_INFINITY,
  }: { now: Date; send: SendReminder; withinDays?: number; deadline?: number },
): Promise<ReminderResult> {
  const soon = new Date(now.getTime() + withinDays * DAY_MS);
  const staleBefore = new Date(now.getTime() - REMINDER_CLAIM_STALE_MS);
  const claimable = { OR: [{ expiryReminderClaimedAt: null }, { expiryReminderClaimedAt: { lt: staleBefore } }] };
  // ช่วงสุดท้ายของสมาชิกที่กำลังใช้งาน (เริ่มแล้วหรือต่อจากช่วงที่เริ่มแล้ว) และไม่มีช่วงไหนหมดหลัง soon
  const candidates = await db.subscription.findMany({
    where: {
      status: { in: [...LIVE_STATUSES] },
      currentPeriodEnd: { gt: now, lte: soon },
      expiryReminderSentAt: null,
      ...claimable,
      user: {
        subscriptions: {
          none: { status: { in: [...LIVE_STATUSES] }, currentPeriodEnd: { gt: soon } },
          some: { status: { in: [...LIVE_STATUSES] }, currentPeriodStart: { lte: now }, currentPeriodEnd: { gt: now } },
        },
      },
    },
    orderBy: { currentPeriodEnd: "asc" },
    take: MAX_MEMBERS_PER_RUN + 1,
    select: {
      id: true,
      userId: true,
      currentPeriodEnd: true,
      plan: { select: { name: true, slug: true, kind: true } },
      user: { select: { email: true, telegramChatId: true } },
    },
  });
  const result: ReminderResult = { reminded: 0, failed: [], hasMore: candidates.length > MAX_MEMBERS_PER_RUN };

  for (const candidate of candidates.slice(0, MAX_MEMBERS_PER_RUN)) {
    if (outOfTime(deadline)) {
      result.hasMore = true;
      break;
    }
    const claimed = await db.subscription.updateMany({
      where: { id: candidate.id, expiryReminderSentAt: null, ...claimable },
      data: { expiryReminderClaimedAt: now, status: "EXPIRING_SOON" },
    });
    if (claimed.count === 0) continue; // อีกรอบจองไปแล้ว

    let delivery: ReminderDelivery = { email: false, telegram: false };
    try {
      delivery = await send({
        userId: candidate.userId,
        email: candidate.user.email,
        telegramChatId: candidate.user.telegramChatId,
        planName: candidate.plan.name,
        planSlug: candidate.plan.slug,
        planKind: candidate.plan.kind,
        endsAt: candidate.currentPeriodEnd,
      });
    } catch (error) {
      console.error("[job:check-expiry] ส่งเตือนก่อนหมดอายุผิดพลาด", { userId: candidate.userId, error });
    }

    if (delivery.email || delivery.telegram) {
      await db.subscription.update({ where: { id: candidate.id }, data: { expiryReminderSentAt: now } });
      result.reminded += 1;
    } else {
      await db.subscription.updateMany({
        where: { id: candidate.id, expiryReminderSentAt: null },
        data: { expiryReminderClaimedAt: null, status: "ACTIVE" },
      });
      result.failed.push({ userId: candidate.userId, email: candidate.user.email });
    }
  }
  return result;
}

/** ข้อความถึงกลุ่มแอดมินไม่ควรมีอีเมลเต็ม (PDPA) — ปิดบางส่วน แล้วให้แอดมินเปิดดูในหลังบ้าน */
export function maskEmail(email: string): string {
  const [local, domain = ""] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

/** ข้อมูลที่สมาชิกกรอกเอง: ตัดบรรทัดใหม่/ความยาว กันการปลอมบรรทัดหรือดันรายการอื่นตกขอบข้อความ */
function cleanField(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").slice(0, SUMMARY_FIELD_MAX);
}

function listLines<T>(items: T[], format: (item: T) => string): string[] {
  const lines = items.slice(0, SUMMARY_LIST_LIMIT).map((item) => `  - ${format(item)}`);
  if (items.length > SUMMARY_LIST_LIMIT) lines.push(`  …และอีก ${items.length - SUMMARY_LIST_LIMIT} คน (ดูหน้า /admin/status)`);
  return lines;
}

/** ข้อความสรุปถึงกลุ่มแอดมิน (ข้อความธรรมดา) — null ถ้าไม่มีอะไรต้องแจ้ง */
export function formatExpirySummary(expire: ExpireResult, reminders: ReminderResult, runId: string, siteUrl: string): string | null {
  const ended = expire.members.filter((member) => !member.continuing);
  const toDeprovision = ended.filter((member) => member.pendingChannels.length > 0);
  if (expire.members.length === 0 && reminders.reminded === 0 && reminders.failed.length === 0 && expire.errors.length === 0) return null;

  const lines = [
    "📋 สรุปงานตรวจวันหมดอายุ",
    `• สิทธิ์หมดอายุ: ${ended.length} คน${expire.members.length > ended.length ? ` (อีก ${expire.members.length - ended.length} คนต่ออายุไว้แล้ว ใช้งานต่อได้)` : ""}`,
    `• ส่งเตือนก่อนหมดอายุ: ${reminders.reminded} คน`,
  ];
  if (toDeprovision.length > 0) {
    lines.push(`⚠️ ต้องถอดสิทธิ์ด้วยมือ ${toDeprovision.length} คน:`);
    lines.push(
      ...listLines(toDeprovision, (member) =>
        [
          maskEmail(member.email),
          member.tradingViewUsername ? `TV: ${cleanField(member.tradingViewUsername)}` : null,
          member.pendingChannels.map((field) => CHANNEL_LABELS[field]).join(", "),
          `${siteUrl}/admin/members/${member.userId}`,
        ]
          .filter(Boolean)
          .join(" | "),
      ),
    );
  }
  if (reminders.failed.length > 0) {
    lines.push(`⚠️ ส่งเตือนไม่สำเร็จ ${reminders.failed.length} คน (จะลองใหม่รอบถัดไป):`);
    lines.push(...listLines(reminders.failed, (failure) => maskEmail(failure.email)));
  }
  if (expire.errors.length > 0) lines.push(`🚨 ทำรายการไม่สำเร็จ ${expire.errors.length} คน — ดูรายละเอียดใน JobRun ${runId}`);
  if (expire.hasMore || reminders.hasMore) lines.push("ℹ️ ยังมีรายการเหลือ จะทำต่อในรอบถัดไป");
  return lines.join("\n");
}

export type ExpiryJobSummary = {
  expiredOrders: number;
  expiredMembers: number;
  continuingMembers: number;
  pendingDeprovisionUserIds: string[];
  reminded: number;
  reminderFailedUserIds: string[];
  errors: { userId: string; message: string }[];
  hasMore: boolean;
  /** ส่งสรุปเข้ากลุ่มแอดมินสำเร็จหรือไม่ (null = ไม่มีอะไรต้องแจ้ง) — Watchdog ตรวจค่า false */
  summaryDelivered: boolean | null;
};

/** งานประจำวัน (Flow 6): ปิดออเดอร์ค้างชำระ → ทำให้สิทธิ์หมดอายุ → เตือนก่อนหมด 3 วัน → สรุปให้แอดมิน */
export async function runExpiryJob(
  db: PrismaClient,
  {
    now = new Date(),
    sendReminder,
    siteUrl,
    alert = sendAdminTelegram,
    timeBudgetMs = JOB_TIME_BUDGET_MS,
  }: { now?: Date; sendReminder: SendReminder; siteUrl: string; alert?: AdminAlert; timeBudgetMs?: number },
): Promise<JobOutcome<ExpiryJobSummary>> {
  const deadline = Date.now() + timeBudgetMs;
  return runJob(
    db,
    JOB_NAMES.CHECK_EXPIRY,
    async ({ runId }) => {
      const expiredOrders = await expireStaleOrders(db, { now });
      const expire = await expireSubscriptions(db, { now, deadline });
      const reminders = await sendExpiryReminders(db, { now, send: sendReminder, deadline });

      const message = formatExpirySummary(expire, reminders, runId, siteUrl);
      const summaryDelivered = message ? (await alert(message)).ok : null;
      if (summaryDelivered === false) console.error("[job:check-expiry] ส่งสรุปเข้ากลุ่มแอดมินไม่สำเร็จ — Watchdog จะเตือน", { runId });

      const summary: ExpiryJobSummary = {
        expiredOrders,
        expiredMembers: expire.members.filter((member) => !member.continuing).length,
        continuingMembers: expire.members.filter((member) => member.continuing).length,
        pendingDeprovisionUserIds: expire.members.filter((member) => !member.continuing && member.pendingChannels.length > 0).map((member) => member.userId),
        reminded: reminders.reminded,
        reminderFailedUserIds: reminders.failed.map((failure) => failure.userId),
        errors: expire.errors,
        hasMore: expire.hasMore || reminders.hasMore,
        summaryDelivered,
      };
      if (expire.errors.length > 0) throw new JobPartialFailure(`ทำให้สิทธิ์หมดอายุไม่สำเร็จ ${expire.errors.length} คน`, summary);
      return summary;
    },
    { alert },
  );
}
