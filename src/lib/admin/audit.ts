import type { Prisma, PrismaClient } from "@prisma/client";
import type { ActorContext } from "./guard";

type Tx = Prisma.TransactionClient;

export const AUDIT_ACTIONS = {
  ORDER_APPROVE: "อนุมัติคำสั่งซื้อ",
  ORDER_REJECT: "ปฏิเสธสลิป",
  ORDER_REFUND: "คืนเงิน",
  MEMBER_REVOKE: "ปิดสิทธิ์สมาชิก",
  PROVISIONING_UPDATE: "อัปเดตการเปิดสิทธิ์",
  SETTINGS_UPDATE: "แก้ไขการตั้งค่าระบบ",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

interface AuditEntry {
  actor: ActorContext;
  action: AuditAction;
  targetType: "Order" | "Subscription" | "User" | "System";
  targetId: string;
  details: Prisma.InputJsonValue;
}

/** บันทึก AuditLog ภายใน transaction เดียวกับการเปลี่ยนแปลง — ถ้าบันทึกไม่ได้ การเปลี่ยนแปลงต้องถูกยกเลิกด้วย */
export async function writeAudit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actor.id,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      details: entry.details,
      ipAddress: entry.actor.ipAddress ?? null,
    },
  });
}

export interface AuditLogItem {
  id: string;
  action: string;
  actionLabel: string;
  targetType: string;
  targetId: string;
  details: Prisma.JsonValue;
  ipAddress: string | null;
  actorEmail: string;
  createdAt: Date;
}

const PAGE_SIZE = 30;

export async function listAuditLogs(
  db: PrismaClient,
  { action, targetId, page = 1 }: { action?: string; targetId?: string; page?: number },
): Promise<{ items: AuditLogItem[]; total: number; page: number; pageSize: number }> {
  const where: Prisma.AuditLogWhereInput = {
    ...(action && Object.prototype.hasOwnProperty.call(AUDIT_ACTIONS, action) ? { action } : {}),
    ...(targetId ? { targetId } : {}),
  };
  const safePage = Math.max(1, Math.floor(page));
  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { email: true } } },
    }),
    db.auditLog.count({ where }),
  ]);
  return {
    items: logs.map((log) => ({
      id: log.id,
      action: log.action,
      actionLabel: AUDIT_ACTIONS[log.action as AuditAction] ?? log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      details: log.details,
      ipAddress: log.ipAddress,
      actorEmail: log.actor.email,
      createdAt: log.createdAt,
    })),
    total,
    page: safePage,
    pageSize: PAGE_SIZE,
  };
}
