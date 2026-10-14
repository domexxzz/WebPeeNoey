import type { OrderStatus, Prisma, PrismaClient } from "@prisma/client";
import { expireStaleOrders } from "@/lib/orders/create-order";
import { SYSTEM_ACTOR_LABEL } from "./audit";

export const ADMIN_ORDER_TABS = {
  review: { label: "รอตรวจสลิป", statuses: ["SLIP_SUBMITTED"] },
  pending: { label: "รอชำระเงิน", statuses: ["PENDING_PAYMENT"] },
  approved: { label: "อนุมัติแล้ว", statuses: ["APPROVED"] },
  rejected: { label: "ปฏิเสธ", statuses: ["REJECTED"] },
  refunded: { label: "คืนเงิน", statuses: ["REFUNDED"] },
  expired: { label: "หมดอายุ", statuses: ["EXPIRED"] },
  all: { label: "ทั้งหมด", statuses: [] },
} as const satisfies Record<string, { label: string; statuses: readonly OrderStatus[] }>;

export type AdminOrderTab = keyof typeof ADMIN_ORDER_TABS;

const PAGE_SIZE = 25;

export function parseAdminOrderTab(raw: string | undefined): AdminOrderTab {
  return raw && Object.prototype.hasOwnProperty.call(ADMIN_ORDER_TABS, raw) ? (raw as AdminOrderTab) : "review";
}

export interface AdminOrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  amount: number;
  planName: string;
  email: string;
  name: string | null;
  createdAt: Date;
  slipUploadedAt: Date | null;
  adminNotifiedAt: Date | null;
}

export async function listAdminOrders(
  db: PrismaClient,
  { tab, q, page = 1, now = new Date() }: { tab: AdminOrderTab; q?: string; page?: number; now?: Date },
): Promise<{ items: AdminOrderListItem[]; total: number; counts: Record<AdminOrderTab, number>; page: number; pageSize: number }> {
  // ออเดอร์ที่เลยเวลาแนบสลิปแล้ว (ยังไม่มีใครเปิดดู) ให้เป็น EXPIRED ก่อนนับ เพื่อให้คิว "รอชำระเงิน" ถูกต้อง
  await expireStaleOrders(db, { now });
  const statuses = ADMIN_ORDER_TABS[tab].statuses as readonly OrderStatus[];
  const query = q?.trim();
  // คำขอสิทธิ์ผ่าน IB มีคิวของตัวเอง (/admin/broker-claims) — รายการนี้เป็นออเดอร์ชำระเงินเท่านั้น
  const where: Prisma.OrderWhereInput = {
    kind: "PAID",
    ...(statuses.length ? { status: { in: [...statuses] } } : {}),
    ...(query
      ? {
          OR: [
            { orderNumber: { contains: query, mode: "insensitive" } },
            { user: { email: { contains: query, mode: "insensitive" } } },
            { payment: { referenceNo: { contains: query.replace(/[\s-]/g, ""), mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const safePage = Math.max(1, Math.floor(page));
  // รอตรวจ: เก่าสุดก่อน (คิว) — แท็บอื่น: ใหม่สุดก่อน
  const orderBy: Prisma.OrderOrderByWithRelationInput = tab === "review" ? { slipUploadedAt: "asc" } : { createdAt: "desc" };

  const [orders, total, grouped] = await Promise.all([
    db.order.findMany({
      where,
      orderBy,
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        amount: true,
        createdAt: true,
        slipUploadedAt: true,
        adminNotifiedAt: true,
        plan: { select: { name: true } },
        user: { select: { email: true, name: true } },
      },
    }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], where: { kind: "PAID" }, _count: { _all: true } }),
  ]);

  const byStatus = new Map(grouped.map((group) => [group.status, group._count._all]));
  const counts = Object.fromEntries(
    Object.entries(ADMIN_ORDER_TABS).map(([key, value]) => [
      key,
      value.statuses.length ? value.statuses.reduce((sum, status) => sum + (byStatus.get(status) ?? 0), 0) : grouped.reduce((sum, group) => sum + group._count._all, 0),
    ]),
  ) as Record<AdminOrderTab, number>;

  return {
    items: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      amount: order.amount.toNumber(),
      planName: order.plan.name,
      email: order.user.email,
      name: order.user.name,
      createdAt: order.createdAt,
      slipUploadedAt: order.slipUploadedAt,
      adminNotifiedAt: order.adminNotifiedAt,
    })),
    total,
    counts,
    page: safePage,
    pageSize: PAGE_SIZE,
  };
}

/** รายละเอียดออเดอร์สำหรับแอดมิน — ไม่โหลดไฟล์สลิป (ดูผ่าน /api/slips/[id]) */
export async function getAdminOrderDetail(db: PrismaClient, orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      plan: { select: { name: true, slug: true, durationDays: true } },
      user: { select: { id: true, email: true, name: true, tradingViewUsername: true, discordUserId: true } },
      payment: { select: { promptpayTarget: true, promptpayAccountName: true, amount: true, referenceNo: true, verifiedAt: true } },
      subscription: { select: { id: true, status: true, currentPeriodStart: true, currentPeriodEnd: true, isPriceLocked: true, tradingViewGranted: true, discordRoleGranted: true, telegramGranted: true } },
      refund: { select: { amount: true, reason: true, transferReference: true, createdAt: true } },
      slipUploads: { orderBy: { createdAt: "desc" }, select: { id: true, mimeType: true, sizeBytes: true, hash: true, createdAt: true } },
    },
  });
  if (!order) return null;
  const auditLogs = await db.auditLog.findMany({
    where: { targetType: "Order", targetId: orderId },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { email: true } } },
  });
  return {
    ...order,
    amount: order.amount.toNumber(),
    basePrice: order.basePrice?.toNumber() ?? null,
    payment: order.payment ? { ...order.payment, amount: order.payment.amount.toNumber() } : null,
    refund: order.refund ? { ...order.refund, amount: order.refund.amount.toNumber() } : null,
    slips: order.slipUploads,
    auditLogs: auditLogs.map((log) => ({ id: log.id, action: log.action, details: log.details, actorEmail: log.actor?.email ?? SYSTEM_ACTOR_LABEL, createdAt: log.createdAt })),
  };
}

export type AdminOrderDetail = NonNullable<Awaited<ReturnType<typeof getAdminOrderDetail>>>;
