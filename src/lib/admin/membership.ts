import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;
/** ช่วงสิทธิ์ที่ยังนับ (ไม่รวม EXPIRED / REVOKED) */
const LIVE_STATUSES = ["ACTIVE", "EXPIRING_SOON"] as const;

export interface MembershipSummary {
  active: boolean;
  /** วันสิ้นสุดสิทธิ์รวมทุกช่วงที่ต่อกัน (null ถ้าไม่มีสิทธิ์) */
  endsAt: Date | null;
  currentSubscriptionId: string | null;
}

/**
 * ช่วงสิทธิ์ถัดไปแบบทบวัน (Flow 5): เริ่มต่อจากวันหมดอายุล่าสุดถ้ายังไม่หมด ไม่งั้นเริ่มตอนนี้
 * ผู้เรียกต้องถือ advisory lock ของผู้ใช้ไว้ เพื่อไม่ให้สองออเดอร์คำนวณช่วงซ้อนกัน
 */
export async function nextPeriodFor(db: Db, { userId, now, durationDays }: { userId: string; now: Date; durationDays: number }) {
  const latest = await db.subscription.findFirst({
    where: { userId, status: { in: [...LIVE_STATUSES] }, currentPeriodEnd: { gt: now } },
    orderBy: { currentPeriodEnd: "desc" },
    select: { currentPeriodEnd: true },
  });
  const start = latest?.currentPeriodEnd ?? now;
  return { start, end: new Date(start.getTime() + durationDays * DAY_MS) };
}

/**
 * จัดช่วงสิทธิ์ที่ยังไม่เริ่มให้ต่อกันใหม่ หลังมีช่วงก่อนหน้าถูกคืนเงิน/ปิดสิทธิ์ (ไม่ให้เกิดช่องว่างที่ลูกค้าเข้าใช้ไม่ได้)
 * ช่วงที่เริ่มไปแล้วคงเดิม — ช่วงที่ยังไม่เริ่มเลื่อนมาต่อท้ายทันทีโดยคงความยาวเดิม
 * ผู้เรียกต้องถือ advisory lock "membership:<userId>"
 */
export async function repackFutureSegments(db: Db, { userId, now }: { userId: string; now: Date }): Promise<number> {
  const live = await db.subscription.findMany({
    where: { userId, status: { in: [...LIVE_STATUSES] }, currentPeriodEnd: { gt: now } },
    orderBy: { currentPeriodStart: "asc" },
    select: { id: true, currentPeriodStart: true, currentPeriodEnd: true },
  });
  let cursor = now.getTime();
  let moved = 0;
  for (const segment of live) {
    const start = segment.currentPeriodStart.getTime();
    const end = segment.currentPeriodEnd.getTime();
    if (start <= now.getTime()) {
      cursor = Math.max(cursor, end);
      continue;
    }
    if (start !== cursor) {
      await db.subscription.update({
        where: { id: segment.id },
        data: { currentPeriodStart: new Date(cursor), currentPeriodEnd: new Date(cursor + (end - start)) },
      });
      moved += 1;
    }
    cursor += end - start;
  }
  return moved;
}

type Segment = { id: string; currentPeriodStart: Date; currentPeriodEnd: Date };

/** รวมช่วงสิทธิ์ที่ยังไม่หมดอายุเป็นสถานะเดียว: ใช้งานได้ถ้ามีช่วงที่เริ่มแล้ว และหมดอายุตามช่วงที่ไกลที่สุด */
function summarize(segments: Segment[], now: Date): MembershipSummary {
  const current = segments.find((segment) => segment.currentPeriodStart <= now);
  if (!current) return { active: false, endsAt: null, currentSubscriptionId: null };
  const endsAt = segments.reduce((max, segment) => (segment.currentPeriodEnd > max ? segment.currentPeriodEnd : max), current.currentPeriodEnd);
  return { active: true, endsAt, currentSubscriptionId: current.id };
}

export async function getMembershipSummary(db: Db, { userId, now = new Date() }: { userId: string; now?: Date }): Promise<MembershipSummary> {
  const live = await db.subscription.findMany({
    where: { userId, status: { in: [...LIVE_STATUSES] }, currentPeriodEnd: { gt: now } },
    orderBy: { currentPeriodStart: "asc" },
    select: { id: true, currentPeriodStart: true, currentPeriodEnd: true },
  });
  return summarize(live, now);
}

/** สรุปสถานะสมาชิกหลายคนในคำสั่งเดียว (ใช้ในหน้ารายชื่อสมาชิก) */
export async function getMembershipSummaries(db: Db, { userIds, now }: { userIds: string[]; now: Date }): Promise<Map<string, MembershipSummary>> {
  const live = await db.subscription.findMany({
    where: { userId: { in: userIds }, status: { in: [...LIVE_STATUSES] }, currentPeriodEnd: { gt: now } },
    orderBy: { currentPeriodStart: "asc" },
    select: { id: true, userId: true, currentPeriodStart: true, currentPeriodEnd: true },
  });
  return new Map<string, MembershipSummary>(
    userIds.map((userId) => [userId, summarize(live.filter((segment) => segment.userId === userId), now)]),
  );
}

export const GRANT_FIELDS = ["tradingViewGranted", "discordRoleGranted", "telegramGranted"] as const;
export type GrantField = (typeof GRANT_FIELDS)[number];

/**
 * ย้ายสถานะ "เปิดสิทธิ์แล้ว" จากช่วงที่จบไปแล้ว (หมดอายุ/คืนเงิน) ไปยังช่วงที่ใช้งานอยู่ตอนนี้ของสมาชิกคนเดียวกัน
 * สมาชิกที่ต่ออายุทบวันยังใช้ช่องทางเดิมต่อเนื่อง — ถ้าไม่ย้าย ช่วงเก่าจะค้างในคิว "ต้องถอดสิทธิ์" ทั้งที่ห้ามถอด
 * คืน null ถ้าไม่มีช่วงที่ใช้งานอยู่ (สมาชิกหมดสิทธิ์จริง ต้องถอดด้วยมือ) หรือไม่มีช่องทางที่เปิดไว้
 * ผู้เรียกต้องถือ advisory lock "membership:<userId>"
 */
export async function carryOverProvisioning(
  db: Db,
  { userId, fromIds, now }: { userId: string; fromIds: string[]; now: Date },
): Promise<{ toSubscriptionId: string; channels: GrantField[] } | null> {
  if (fromIds.length === 0) return null;
  const current = await db.subscription.findFirst({
    where: { userId, id: { notIn: fromIds }, status: { in: [...LIVE_STATUSES] }, currentPeriodStart: { lte: now }, currentPeriodEnd: { gt: now } },
    orderBy: { currentPeriodStart: "asc" },
    select: { id: true },
  });
  if (!current) return null;
  const ended = await db.subscription.findMany({
    where: { userId, id: { in: fromIds } },
    select: { tradingViewGranted: true, discordRoleGranted: true, telegramGranted: true },
  });
  const channels = GRANT_FIELDS.filter((field) => ended.some((segment) => segment[field]));
  if (channels.length === 0) return null;
  const flags = (value: boolean) => Object.fromEntries(channels.map((field) => [field, value])) as Partial<Record<GrantField, boolean>>;
  await db.subscription.update({ where: { id: current.id }, data: flags(true) });
  await db.subscription.updateMany({ where: { id: { in: fromIds } }, data: flags(false) });
  return { toSubscriptionId: current.id, channels };
}
