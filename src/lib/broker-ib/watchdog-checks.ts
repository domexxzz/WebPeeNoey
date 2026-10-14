import type { PrismaClient } from "@prisma/client";
import { BROKER_IB_RULES } from "@/config/broker-ib";
import { markAdminNotified } from "@/lib/orders/submit-slip";
import type { AdminAlert } from "@/lib/jobs/job-run";
import { buildNewBrokerClaimMessage } from "./notification";
import { maskAccountNumber } from "./validation";

/** งานเฝ้าระวังของสิทธิ์ผ่าน IB (เรียกจาก Watchdog รายชั่วโมง) — ห้ามให้คำขอค้างโดยไม่มีใครรู้ */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const NOTIFY_GRACE_MINUTES = 2;
const RETRY_LIMIT = 20;

export async function checkBrokerClaimQueue(db: PrismaClient, now: Date): Promise<{ key: string; message: string }[]> {
  const hours = BROKER_IB_RULES.claimReviewOverdueHours;
  const overdue = await db.order.count({
    where: { kind: "BROKER_IB", status: "CLAIM_SUBMITTED", createdAt: { lt: new Date(now.getTime() - hours * HOUR_MS) } },
  });
  return overdue > 0 ? [{ key: "broker-claim-overdue", message: `มีคำขอสิทธิ์ผ่าน IB รอตรวจเกิน ${hours} ชั่วโมง ${overdue} รายการ — สมาชิกกำลังรอสิทธิ์` }] : [];
}

/** คำขอที่แจ้งกลุ่มแอดมินไม่สำเร็จตอนยื่น → ส่งซ้ำ (หยุดที่ความล้มเหลวแรก ไม่ยิง Telegram ซ้ำ ๆ ตอนล่ม) */
export async function renotifyBrokerClaims(db: PrismaClient, { now, siteUrl, alert }: { now: Date; siteUrl: string; alert: AdminAlert }) {
  const pending = await db.order.findMany({
    where: {
      kind: "BROKER_IB",
      status: "CLAIM_SUBMITTED",
      adminNotifiedAt: null,
      createdAt: { lte: new Date(now.getTime() - NOTIFY_GRACE_MINUTES * MINUTE_MS) },
    },
    orderBy: { createdAt: "asc" },
    take: RETRY_LIMIT,
    select: { id: true, orderNumber: true, brokerAccount: { select: { broker: true, accountNumber: true, firstVerifiedAt: true } } },
  });
  let sent = 0;
  for (const order of pending) {
    if (!order.brokerAccount) continue;
    const result = await alert(
      buildNewBrokerClaimMessage(
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          broker: order.brokerAccount.broker,
          accountMasked: maskAccountNumber(order.brokerAccount.accountNumber),
          isRenewal: order.brokerAccount.firstVerifiedAt !== null,
        },
        siteUrl,
        { retry: true },
      ),
    );
    if (!result.ok) break;
    await markAdminNotified(db, { orderId: order.id, now });
    sent += 1;
  }
  return { sent, failed: pending.length - sent };
}
