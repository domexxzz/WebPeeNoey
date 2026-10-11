import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowRight, Receipt } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listOrdersForUser } from "@/lib/orders/checkout";
import { OrderStatusBadge } from "@/components/checkout/order-status-badge";

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
      <header>
        <h1 className="font-heading text-3xl font-bold text-white">ประวัติคำสั่งซื้อ</h1>
        <p className="mt-2 text-sm text-gray-400">ติดตามสถานะการชำระเงินและการตรวจสอบสลิปของทุกคำสั่งซื้อ</p>
      </header>

      {orders.length === 0 ? (
        <div className="rounded-2xl glass-panel p-10 text-center">
          <Receipt className="mx-auto w-10 h-10 text-gray-500" aria-hidden="true" />
          <p className="mt-4 text-sm text-gray-300">ยังไม่มีคำสั่งซื้อ</p>
          <Link href="/#pricing" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300">
            เลือกแพ็กเกจ <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-white/10 rounded-2xl glass-panel">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/checkout/order/${order.id}`}
                className="flex flex-col gap-2 p-5 hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
              >
                <div>
                  <p className="font-mono text-sm text-white">{order.orderNumber}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {order.planName} · {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-heading font-semibold text-amber-300">{formatBaht(order.amount)} ฿</span>
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
