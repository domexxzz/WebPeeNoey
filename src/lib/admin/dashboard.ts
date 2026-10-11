import { Prisma, type PrismaClient } from "@prisma/client";
import { PAYMENT_RULES } from "@/config/payment";
import { getPaymentAvailability, type PaymentAvailability } from "@/lib/orders/availability";

const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE_STATUSES = ["ACTIVE", "EXPIRING_SOON"] as const;

export interface MemberCounts {
  /** จำนวน "คน" ที่มีสิทธิ์ใช้งานอยู่ตอนนี้ (ไม่ใช่จำนวนช่วงสิทธิ์) */
  active: number;
  /** จำนวนคนที่สิทธิ์รวมทุกช่วงที่ต่อกันจะหมดภายใน N วัน (คนที่ต่ออายุทบวันไว้แล้วไม่นับ) */
  expiringSoon: number;
}

/** นับสมาชิกรายคน: รวมช่วงสิทธิ์ที่ต่อกันของแต่ละคน แล้วดูวันเริ่มแรกสุดกับวันหมดไกลสุด */
export async function getMemberCounts(
  db: PrismaClient,
  { now = new Date(), withinDays = PAYMENT_RULES.expiryReminderDays }: { now?: Date; withinDays?: number } = {},
): Promise<MemberCounts> {
  const members = await db.subscription.groupBy({
    by: ["userId"],
    where: { status: { in: [...LIVE_STATUSES] }, currentPeriodEnd: { gt: now } },
    having: { currentPeriodStart: { _min: { lte: now } } },
    _max: { currentPeriodEnd: true },
  });
  const soon = new Date(now.getTime() + withinDays * DAY_MS);
  return {
    active: members.length,
    expiringSoon: members.filter((member) => member._max.currentPeriodEnd !== null && member._max.currentPeriodEnd <= soon).length,
  };
}

export interface RevenueSummary {
  /** ยอดที่รับเข้าจริงจากออเดอร์ที่อนุมัติ (รวมออเดอร์ที่คืนเงินภายหลัง) */
  gross: number;
  refunded: number;
  net: number;
  paidOrders: number;
}

/** ยอดขายสุทธิ = รับเข้า − คืนเงิน (คำนวณด้วย Decimal ในฐานข้อมูล ไม่โหลดทุกออเดอร์มาบวกเอง) */
export async function getRevenueSummary(db: PrismaClient): Promise<RevenueSummary> {
  const [sold, refunds] = await Promise.all([
    db.order.aggregate({ where: { status: { in: ["APPROVED", "REFUNDED"] } }, _sum: { amount: true }, _count: { _all: true } }),
    db.refund.aggregate({ _sum: { amount: true } }),
  ]);
  const gross = sold._sum.amount ?? new Prisma.Decimal(0);
  const refunded = refunds._sum.amount ?? new Prisma.Decimal(0);
  return { gross: gross.toNumber(), refunded: refunded.toNumber(), net: gross.minus(refunded).toNumber(), paidOrders: sold._count._all };
}

export interface DashboardStats {
  revenue: RevenueSummary;
  members: MemberCounts;
  totalUsers: number;
  pendingReview: number;
  pendingDeprovision: number;
  payments: PaymentAvailability;
}

/** สิทธิ์ที่หมดอายุ/ถูกปิดแล้วแต่ยังบันทึกว่าเปิดไว้ในช่องทางใดช่องทางหนึ่ง → แอดมินต้องถอดด้วยมือ */
export function countPendingDeprovision(db: PrismaClient): Promise<number> {
  return db.subscription.count({
    where: { status: { in: ["EXPIRED", "REVOKED"] }, OR: [{ tradingViewGranted: true }, { discordRoleGranted: true }, { telegramGranted: true }] },
  });
}

export async function getDashboardStats(db: PrismaClient, { now = new Date() }: { now?: Date } = {}): Promise<DashboardStats> {
  const [revenue, members, totalUsers, pendingReview, pendingDeprovision, payments] = await Promise.all([
    getRevenueSummary(db),
    getMemberCounts(db, { now }),
    db.user.count(),
    db.order.count({ where: { status: "SLIP_SUBMITTED" } }),
    countPendingDeprovision(db),
    getPaymentAvailability(db),
  ]);
  return { revenue, members, totalUsers, pendingReview, pendingDeprovision, payments };
}
