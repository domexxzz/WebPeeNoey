import type { Broker, OrderStatus, PrismaClient } from "@prisma/client";
import { BROKER_IB_PLAN } from "@/config/broker-ib";
import { nextPeriodFor } from "@/lib/admin/membership";
import { getBrokerIbAvailability, type BrokerIbAvailability } from "./availability";
import { resolveBrokerIbMemberState, type BrokerIbMemberState } from "./rules";
import { maskAccountNumber } from "./validation";

const HISTORY_LIMIT = 20;

export interface ClaimHistoryItem {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  broker: Broker | null;
  accountMasked: string | null;
}

export interface BrokerIbMemberStatus {
  state: BrokerIbMemberState;
  availability: BrokerIbAvailability;
  history: ClaimHistoryItem[];
}

/** ข้อมูลทั้งหมดของหน้า /account/broker-ib สำหรับสมาชิกคนเดียว */
export async function getBrokerIbStatusForUser(db: PrismaClient, { userId, now = new Date() }: { userId: string; now?: Date }): Promise<BrokerIbMemberStatus> {
  const [availability, orders, binding, period, ibLive] = await Promise.all([
    getBrokerIbAvailability(db),
    db.order.findMany({
      where: { userId, kind: "BROKER_IB" },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        approvedAt: true,
        rejectedAt: true,
        rejectionReason: true,
        brokerAccount: { select: { broker: true, platform: true, accountNumber: true, firstVerifiedAt: true } },
      },
    }),
    db.brokerAccount.findFirst({ where: { userId, status: { in: ["PENDING", "VERIFIED"] } }, select: { broker: true, platform: true, accountNumber: true, status: true } }),
    nextPeriodFor(db, { userId, now, durationDays: BROKER_IB_PLAN.durationDays }),
    db.subscription.findFirst({
      where: { userId, plan: { kind: "BROKER_IB" }, status: { in: ["ACTIVE", "EXPIRING_SOON"] }, currentPeriodEnd: { gt: now } },
      orderBy: { currentPeriodEnd: "desc" },
      select: { currentPeriodEnd: true },
    }),
  ]);

  const pending = orders.find((order) => order.status === "CLAIM_SUBMITTED");
  const latest = orders[0];
  const state = resolveBrokerIbMemberState({
    now,
    availability,
    pendingClaim:
      pending?.brokerAccount
        ? {
            orderNumber: pending.orderNumber,
            submittedAt: pending.createdAt,
            broker: pending.brokerAccount.broker,
            platform: pending.brokerAccount.platform,
            accountMasked: maskAccountNumber(pending.brokerAccount.accountNumber),
            isRenewal: pending.brokerAccount.firstVerifiedAt !== null,
          }
        : null,
    binding: binding ? { broker: binding.broker, platform: binding.platform, accountMasked: maskAccountNumber(binding.accountNumber), status: binding.status } : null,
    nextStart: period.start,
    ibActiveUntil: ibLive?.currentPeriodEnd ?? null,
    // แสดงเหตุผลเฉพาะเมื่อคำขอล่าสุดถูกปฏิเสธ (ยื่นใหม่ผ่านแล้วไม่ต้องแสดงเหตุผลเก่า)
    lastRejection: latest?.status === "REJECTED" && latest.rejectedAt ? { reason: latest.rejectionReason ?? "", at: latest.rejectedAt } : null,
  });

  return {
    state,
    availability,
    history: orders.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      approvedAt: order.approvedAt,
      rejectedAt: order.rejectedAt,
      rejectionReason: order.rejectionReason,
      broker: order.brokerAccount?.broker ?? null,
      accountMasked: order.brokerAccount ? maskAccountNumber(order.brokerAccount.accountNumber) : null,
    })),
  };
}
