import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowRight, Receipt } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listOrdersForUser } from "@/lib/orders/checkout";
import { OrderStatusBadge } from "@/components/checkout/order-status-badge";
import { AccountPageHeader } from "@/components/account/account-page-header";

export const metadata: Metadata = { title: "ประวัติคำสั่งซื้อ", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const formatBaht = (amount: number) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
const formatDate = (date: Date) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(date);

export default async function OrdersPage() {
  const session = await getServerSession(authOptions);
  const orders = session?.user ? await listOrdersForUser(prisma, { userId: session.user.id }) : [];

  return (
    <div className="space-y-6">
      <AccountPageHeader eyebrow="บัญชีของฉัน" title="ประวัติคำสั่งซื้อ" description="ติดตามสถานะการชำระเงินและการตรวจสอบสลิปของทุกคำสั่งซื้อ" />

      {orders.length === 0 ? (
        <div className="border border-line bg-surface p-10 text-center rounded-2xl">
          <Receipt className="mx-auto w-10 h-10 text-fg-subtle" aria-hidden="true" />
          <p className="mt-4 text-sm text-fg-muted">ยังไม่มีคำสั่งซื้อ</p>
          <Link href="/#pricing" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gold-ink hover:text-gold-ink">
            เลือกแพ็กเกจ <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line-soft border border-line bg-surface rounded-2xl overflow-hidden">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/checkout/order/${order.id}`}
                className="flex flex-col gap-2 p-5 hover:bg-fg/5 sm:flex-row sm:items-center sm:justify-between focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-ink"
              >
                <div>
                  <p className="font-mono text-sm text-fg">{order.orderNumber}</p>
                  <p className="mt-1 text-xs text-fg-subtle">
                    {order.planName} · {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-display text-lg font-bold text-fg tabular-nums">{formatBaht(order.amount)} ฿</span>
                  <OrderStatusBadge phase={order.phase} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
