import type { Prisma, PrismaClient } from "@prisma/client";
import type { ActorContext } from "./guard";

/** เขียนได้ทั้งใน transaction (กรณีที่ต้องล้มพร้อมการเปลี่ยนแปลง) และนอก transaction (กรณีที่ไม่มีอะไรให้ย้อนกลับ) */
type Tx = Prisma.TransactionClient | PrismaClient;

export const AUDIT_ACTIONS = {
  ORDER_APPROVE: "อนุมัติคำสั่งซื้อ",
  ORDER_REJECT: "ปฏิเสธสลิป",
  ORDER_REFUND: "คืนเงิน",
  MEMBER_REVOKE: "ปิดสิทธิ์สมาชิก",
  MEMBER_ROLE_CHANGE: "เปลี่ยนสิทธิ์การใช้งานระบบ",
  PROVISIONING_UPDATE: "อัปเดตการเปิดสิทธิ์",
  SETTINGS_UPDATE: "แก้ไขการตั้งค่าระบบ",
  SUBSCRIPTION_EXPIRE: "สิทธิ์หมดอายุ (อัตโนมัติ)",
  // แก้วันสิ้นสุดของช่วงสิทธิ์โดยตรงในฐานข้อมูล (ไม่มีปุ่มในหลังบ้าน) — เช่น 29 ต.ค. 2569 ลดสิทธิ์ทดลอง IB ให้ตรงกับแพ็กเกจ (ดู docs/HANDOFF.md)
  SUBSCRIPTION_ADJUST: "ปรับวันหมดอายุของสิทธิ์",
  PROVISIONING_CARRY_OVER: "ย้ายสถานะเปิดสิทธิ์ไปช่วงถัดไป (อัตโนมัติ)",
  IB_SETTINGS_UPDATE: "แก้ไขการตั้งค่าสิทธิ์ผ่าน IB",
  BROKER_CLAIM_APPROVE: "อนุมัติสิทธิ์ผ่าน IB",
  BROKER_CLAIM_REJECT: "ปฏิเสธคำขอสิทธิ์ผ่าน IB",
  BROKER_IB_REVOKE: "ปิดสิทธิ์ผ่าน IB",
  BROKER_ACCOUNT_RELEASE: "ปลดการผูกบัญชีโบรกเกอร์",
  BROKER_REPORT_IMPORT: "นำเข้ารายงานโบรกเกอร์ (อนุมัติอัตโนมัติ)",
  ADMIN_ACTION_REFUSED: "คำสั่งหลังบ้านถูกปฏิเสธ",
} as const;

/** ชื่อที่แสดงแทนผู้กระทำเมื่อเป็นงานอัตโนมัติ (actorId = null) */
export const SYSTEM_ACTOR_LABEL = "ระบบอัตโนมัติ";

export type AuditAction = keyof typeof AUDIT_ACTIONS;

/** สิ่งที่ถูกกระทำ — แยกออกมาเพื่อส่งต่อได้เป็นก้อนเดียว */
export interface AuditTarget {
  targetType: "Order" | "Subscription" | "User" | "System" | "BrokerAccount";
  targetId: string;
}

interface AuditEntry extends AuditTarget {
  /** null = งานอัตโนมัติของระบบ (Cron) */
  actor: ActorContext | null;
  action: AuditAction;
  details: Prisma.InputJsonValue;
}

/** บันทึก AuditLog ภายใน transaction เดียวกับการเปลี่ยนแปลง — ถ้าบันทึกไม่ได้ การเปลี่ยนแปลงต้องถูกยกเลิกด้วย */
export async function writeAudit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actor?.id ?? null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      details: entry.details,
      ipAddress: entry.actor?.ipAddress ?? null,
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
      actorEmail: log.actor?.email ?? SYSTEM_ACTOR_LABEL,
      createdAt: log.createdAt,
    })),
    total,
    page: safePage,
    pageSize: PAGE_SIZE,
  };
}
