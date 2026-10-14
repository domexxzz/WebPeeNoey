import type { Prisma, PrismaClient } from "@prisma/client";
import type { ActorContext } from "./guard";
import { writeAudit } from "./audit";
import { getMembershipSummaries, getMembershipSummary, type MembershipSummary } from "./membership";

const PAGE_SIZE = 20;
const REASON_MIN = 2;
const REASON_MAX = 300;

export interface MemberListItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
  tradingViewUsername: string | null;
  discordUserId: string | null;
  createdAt: Date;
  membership: MembershipSummary;
}

export async function searchMembers(
  db: PrismaClient,
  { q, page = 1, now = new Date() }: { q?: string; page?: number; now?: Date },
): Promise<{ items: MemberListItem[]; total: number; page: number; pageSize: number }> {
  const query = q?.trim();
  // เลขบัญชีเทรดที่ผูกไว้ (สิทธิ์ผ่าน IB) — ค้นเฉพาะเมื่อมีตัวเลข (กันคำค้นอย่าง "-" กลายเป็นค่าว่างแล้วได้ทุกคน)
  const accountDigits = query?.replace(/\D/g, "") ?? "";
  const where: Prisma.UserWhereInput = query
    ? {
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
          { tradingViewUsername: { contains: query, mode: "insensitive" } },
          { discordUserId: { contains: query } },
          ...(accountDigits ? [{ brokerAccounts: { some: { accountNumber: { contains: accountDigits } } } }] : []),
        ],
      }
    : {};
  const safePage = Math.max(1, Math.floor(page));
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, email: true, name: true, role: true, tradingViewUsername: true, discordUserId: true, createdAt: true },
    }),
    db.user.count({ where }),
  ]);
  const summaries = await getMembershipSummaries(db, { userIds: users.map((user) => user.id), now });
  return {
    items: users.map((user) => ({ ...user, membership: summaries.get(user.id)! })),
    total,
    page: safePage,
    pageSize: PAGE_SIZE,
  };
}

export async function getMemberDetail(db: PrismaClient, { userId, now = new Date() }: { userId: string; now?: Date }) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      tradingViewUsername: true,
      discordUserId: true,
      telegramChatId: true,
      createdAt: true,
      orders: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, orderNumber: true, status: true, kind: true, amount: true, createdAt: true, plan: { select: { name: true } } },
      },
      subscriptions: {
        orderBy: { currentPeriodStart: "desc" },
        take: 50,
        select: {
          id: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          isPriceLocked: true,
          lockedPrice: true,
          tradingViewGranted: true,
          discordRoleGranted: true,
          telegramGranted: true,
          revokedAt: true,
          revocationReason: true,
          plan: { select: { name: true, kind: true } },
          order: { select: { id: true, orderNumber: true } },
        },
      },
      brokerAccounts: {
        orderBy: { updatedAt: "desc" },
        select: { id: true, broker: true, platform: true, accountNumber: true, registeredEmail: true, status: true, firstVerifiedAt: true, lastVerifiedAt: true },
      },
    },
  });
  if (!user) return null;
  return {
    ...user,
    orders: user.orders.map((order) => ({ ...order, amount: order.amount.toNumber() })),
    subscriptions: user.subscriptions.map((subscription) => ({ ...subscription, lockedPrice: subscription.lockedPrice?.toNumber() ?? null })),
    membership: await getMembershipSummary(db, { userId, now }),
  };
}

export type RevokeResult = { ok: true; revoked: number } | { ok: false; code: "MEMBER_NOT_FOUND" | "REASON_REQUIRED" };

/** ปิดสิทธิ์ฉุกเฉิน (Flow 7.1) — ปิดทุกช่วงสิทธิ์ที่ยังใช้งาน/รอเริ่ม พร้อม AuditLog */
export async function revokeMemberAccess(
  db: PrismaClient,
  input: { userId: string; actor: ActorContext; reason: string; now?: Date },
): Promise<RevokeResult> {
  const now = input.now ?? new Date();
  const reason = input.reason.trim().replace(/\s+/g, " ");
  if (reason.length < REASON_MIN || reason.length > REASON_MAX) return { ok: false, code: "REASON_REQUIRED" };

  return db.$transaction(async (tx): Promise<RevokeResult> => {
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true, email: true } });
    if (!user) return { ok: false, code: "MEMBER_NOT_FOUND" };
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`membership:${user.id}`}))`;
    const live = await tx.subscription.findMany({
      where: { userId: user.id, status: { in: ["ACTIVE", "EXPIRING_SOON"] }, currentPeriodEnd: { gt: now } },
      select: { id: true, tradingViewGranted: true, discordRoleGranted: true, telegramGranted: true },
    });
    const { count } = await tx.subscription.updateMany({
      where: { id: { in: live.map((subscription) => subscription.id) } },
      data: { status: "REVOKED", revokedAt: now, revocationReason: reason },
    });
    await writeAudit(tx, {
      actor: input.actor,
      action: "MEMBER_REVOKE",
      targetType: "User",
      targetId: user.id,
      details: { email: user.email, reason, subscriptionsRevoked: count, subscriptions: live },
    });
    return { ok: true, revoked: count };
  });
}

export const PROVISIONING_CHANNELS = {
  tradingView: { field: "tradingViewGranted", label: "TradingView" },
  discord: { field: "discordRoleGranted", label: "Discord" },
  telegram: { field: "telegramGranted", label: "Telegram" },
} as const;

export type ProvisioningChannel = keyof typeof PROVISIONING_CHANNELS;

/** บันทึกการเปิด/ปิดสิทธิ์แต่ละช่องทางด้วยมือ (TradingView ไม่มี API ทางการ) */
export async function setProvisioning(
  db: PrismaClient,
  input: { subscriptionId: string; channel: ProvisioningChannel; granted: boolean; actor: ActorContext },
): Promise<{ ok: false } | { ok: true; orderId: string; userId: string }> {
  const { field } = PROVISIONING_CHANNELS[input.channel];
  return db.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({ where: { id: input.subscriptionId }, select: { id: true, orderId: true, userId: true, [field]: true } });
    if (!subscription) return { ok: false as const };
    const before = Boolean((subscription as Record<string, unknown>)[field]);
    await tx.subscription.update({ where: { id: input.subscriptionId }, data: { [field]: input.granted } });
    await writeAudit(tx, {
      actor: input.actor,
      action: "PROVISIONING_UPDATE",
      targetType: "Subscription",
      targetId: input.subscriptionId,
      details: { channel: input.channel, before, after: input.granted },
    });
    return { ok: true as const, orderId: subscription.orderId, userId: subscription.userId };
  });
}
