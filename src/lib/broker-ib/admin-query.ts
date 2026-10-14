import type { OrderStatus, Prisma, PrismaClient } from "@prisma/client";
import { BROKER_IB_RULES } from "@/config/broker-ib";
import { SYSTEM_ACTOR_LABEL } from "@/lib/admin/audit";
import { nextPeriodFor } from "@/lib/admin/membership";
import { readBrokerIbSettingValues, computeBrokerIbAvailability } from "./availability";
import { isWithinClaimWindow } from "./rules";

const PAGE_SIZE = 30;
const HOUR_MS = 60 * 60 * 1000;

export const BROKER_CLAIM_TABS = {
  review: { label: "รอตรวจ", statuses: ["CLAIM_SUBMITTED"] },
  approved: { label: "อนุมัติแล้ว", statuses: ["APPROVED"] },
  rejected: { label: "ปฏิเสธ", statuses: ["REJECTED"] },
  all: { label: "ทั้งหมด", statuses: [] },
} as const satisfies Record<string, { label: string; statuses: readonly OrderStatus[] }>;

export type BrokerClaimTab = keyof typeof BROKER_CLAIM_TABS;

export function parseBrokerClaimTab(value: string | undefined): BrokerClaimTab {
  return value && Object.prototype.hasOwnProperty.call(BROKER_CLAIM_TABS, value) ? (value as BrokerClaimTab) : "review";
}

export function countPendingBrokerClaims(db: PrismaClient): Promise<number> {
  return db.order.count({ where: { kind: "BROKER_IB", status: "CLAIM_SUBMITTED" } });
}

const isOverdue = (createdAt: Date, now: Date) => now.getTime() - createdAt.getTime() > BROKER_IB_RULES.claimReviewOverdueHours * HOUR_MS;

/** คิวคำขอสิทธิ์ผ่าน IB — แท็บรอตรวจเรียงเก่าสุดก่อน, ค้นหาด้วยเลขคำขอ / อีเมล / เลขบัญชีเทรด */
export async function listBrokerClaims(db: PrismaClient, { tab, q, page = 1, now = new Date() }: { tab: BrokerClaimTab; q?: string; page?: number; now?: Date }) {
  const statuses = BROKER_CLAIM_TABS[tab].statuses as readonly OrderStatus[];
  const query = q?.trim();
  const where: Prisma.OrderWhereInput = {
    kind: "BROKER_IB",
    ...(statuses.length ? { status: { in: [...statuses] } } : {}),
    ...(query
      ? {
          OR: [
            { orderNumber: { contains: query, mode: "insensitive" } },
            { user: { email: { contains: query, mode: "insensitive" } } },
            { brokerAccount: { accountNumber: { contains: query.replace(/[\s-]/g, "") } } },
            { brokerAccount: { registeredEmail: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const safePage = Math.max(1, Math.floor(page));
  const [orders, total, grouped] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: tab === "review" ? "asc" : "desc" },
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        adminNotifiedAt: true,
        user: { select: { email: true } },
        brokerAccount: { select: { broker: true, platform: true, accountNumber: true, firstVerifiedAt: true } },
      },
    }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], where: { kind: "BROKER_IB" }, _count: { _all: true } }),
  ]);
  const byStatus = new Map(grouped.map((group) => [group.status, group._count._all]));
  const counts = Object.fromEntries(
    (Object.keys(BROKER_CLAIM_TABS) as BrokerClaimTab[]).map((key) => {
      const tabStatuses = BROKER_CLAIM_TABS[key].statuses as readonly OrderStatus[];
      const count = tabStatuses.length
        ? tabStatuses.reduce((sum, status) => sum + (byStatus.get(status) ?? 0), 0)
        : grouped.reduce((sum, group) => sum + group._count._all, 0);
      return [key, count];
    }),
  ) as Record<BrokerClaimTab, number>;

  return {
    items: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      adminNotifiedAt: order.adminNotifiedAt,
      email: order.user.email,
      broker: order.brokerAccount?.broker ?? null,
      platform: order.brokerAccount?.platform ?? null,
      accountNumber: order.brokerAccount?.accountNumber ?? null,
      isRenewal: Boolean(order.brokerAccount?.firstVerifiedAt) && order.status === "CLAIM_SUBMITTED",
      overdue: order.status === "CLAIM_SUBMITTED" && isOverdue(order.createdAt, now),
    })),
    total,
    counts,
    page: safePage,
    pageSize: PAGE_SIZE,
  };
}

/** รายละเอียดคำขอสำหรับแอดมิน + คำเตือนที่ต้องดูก่อนอนุมัติ */
export async function getBrokerClaimDetail(db: PrismaClient, { orderId, now = new Date() }: { orderId: string; now?: Date }) {
  const order = await db.order.findFirst({
    where: { id: orderId, kind: "BROKER_IB" },
    include: {
      plan: { select: { name: true, durationDays: true } },
      user: { select: { id: true, email: true, name: true, tradingViewUsername: true, discordUserId: true } },
      brokerAccount: true,
      subscription: { select: { id: true, status: true, currentPeriodStart: true, currentPeriodEnd: true, isPriceLocked: true, tradingViewGranted: true, discordRoleGranted: true, telegramGranted: true } },
    },
  });
  if (!order) return null;

  const [settingValues, auditLogs, otherClaimants, period] = await Promise.all([
    readBrokerIbSettingValues(db),
    db.auditLog.findMany({ where: { targetType: "Order", targetId: orderId }, orderBy: { createdAt: "desc" }, include: { actor: { select: { email: true } } } }),
    order.brokerAccountId
      ? db.order.findMany({ where: { brokerAccountId: order.brokerAccountId, userId: { not: order.userId } }, distinct: ["userId"], select: { user: { select: { email: true } } } })
      : Promise.resolve([]),
    nextPeriodFor(db, { userId: order.userId, now, durationDays: order.plan.durationDays }),
  ]);

  const pending = order.status === "CLAIM_SUBMITTED";
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    approvedAt: order.approvedAt,
    rejectedAt: order.rejectedAt,
    rejectionReason: order.rejectionReason,
    termsAcceptedAt: order.termsAcceptedAt,
    termsVersion: order.termsVersion,
    createdIp: order.createdIp,
    plan: order.plan,
    user: order.user,
    brokerAccount: order.brokerAccount,
    subscription: order.subscription,
    minDepositAtSubmission: order.ibMinDepositUsd?.toNumber() ?? null,
    currentMinDeposit: settingValues?.ibMinDepositUsd ?? null,
    availability: computeBrokerIbAvailability(settingValues),
    isRenewal: Boolean(order.brokerAccount?.firstVerifiedAt) && pending,
    emailDiffersFromMember: Boolean(order.brokerAccount && order.brokerAccount.registeredEmail !== order.user.email.toLowerCase()),
    previousClaimants: otherClaimants.map((claim) => claim.user.email),
    nextPeriod: pending ? period : null,
    windowViolation: pending && !isWithinClaimWindow(period.start, now),
    accountReleased: order.brokerAccount?.status === "RELEASED" || (order.brokerAccount !== null && order.brokerAccount.userId !== order.userId),
    auditLogs: auditLogs.map((log) => ({ id: log.id, action: log.action, actorEmail: log.actor?.email ?? SYSTEM_ACTOR_LABEL, createdAt: log.createdAt })),
  };
}

export type BrokerClaimDetail = NonNullable<Awaited<ReturnType<typeof getBrokerClaimDetail>>>;
