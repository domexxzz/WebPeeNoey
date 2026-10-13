import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/page-guard";
import Link from "next/link";
import { BellOff, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatBaht, formatDateTime, parsePage } from "@/lib/format";
import { ADMIN_ORDER_TABS, listAdminOrders, parseAdminOrderTab, type AdminOrderTab } from "@/lib/admin/orders-query";
import { AdminOrderBadge, AdminPageHeader, inputClass, Pagination } from "@/components/admin/admin-ui";

export const metadata: Metadata = { title: "จัดการคำสั่งซื้อ", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}

function tabHref(tab: AdminOrderTab, q?: string, page?: number) {
  const params = new URLSearchParams({ tab });
  if (q) params.set("q", q);
  if (page && page > 1) params.set("page", String(page));
  return `/admin/orders?${params.toString()}`;
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const query = await searchParams;
  await requireAdminPage();
  const tab = parseAdminOrderTab(query.tab);
  const q = query.q?.trim().slice(0, 100) || undefined;
  const page = parsePage(query.page);
  const { items, total, counts, pageSize } = await listAdminOrders(prisma, { tab, q, page });

  return (
    <div className="space-y-6">
      <AdminPageHeader title="คำสั่งซื้อ" description="ตรวจสลิปตามลำดับเวลาที่ส่ง (เก่าสุดก่อน) — อนุมัติต้องกรอกเลขอ้างอิงธนาคารทุกครั้ง">
        <form role="search" className="flex gap-2" action="/admin/orders">
          <input type="hidden" name="tab" value={tab} />
          <label className="sr-only" htmlFor="order-search">ค้นหาคำสั่งซื้อ</label>
          <input id="order-search" name="q" defaultValue={q} placeholder="เลขออเดอร์ / อีเมล / เลขอ้างอิง" className={`${inputClass} sm:w-72`} />
          <button type="submit" className="bg-white/10 px-3 text-gray-200 hover:bg-white/20" aria-label="ค้นหา">
            <Search className="w-4 h-4" aria-hidden="true" />
          </button>
        </form>
      </AdminPageHeader>

      <nav aria-label="สถานะคำสั่งซื้อ" className="flex flex-wrap gap-2">
        {(Object.keys(ADMIN_ORDER_TABS) as AdminOrderTab[]).map((key) => (
          <Link
            key={key}
            href={tabHref(key, q)}
            aria-current={key === tab ? "page" : undefined}
            className={`border px-3.5 py-1.5 text-xs font-medium transition-colors rounded-xl ${
              key === tab ? "border-signal bg-signal text-ink" : "border-line text-gray-300 hover:bg-white/5"
            }`}
          >
            {ADMIN_ORDER_TABS[key].label} <span className="ml-1 tabular-nums opacity-70">{counts[key]}</span>
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto border border-line bg-ink rounded-2xl">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-gray-400">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-medium">คำสั่งซื้อ</th>
              <th className="px-4 py-3 font-medium">ลูกค้า</th>
              <th className="px-4 py-3 font-medium text-right">ยอดที่ต้องได้รับ</th>
              <th className="px-4 py-3 font-medium">ส่งสลิปเมื่อ</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  ไม่มีคำสั่งซื้อในหมวดนี้
                </td>
              </tr>
            )}
            {items.map((order) => (
              <tr key={order.id} className="hover:bg-white/5">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${order.id}`} className="font-mono text-signal hover:underline">
                    {order.orderNumber}
                  </Link>
                  <div className="text-xs text-gray-400">{order.planName}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-white">{order.name ?? "—"}</div>
                  <div className="text-xs text-gray-400">{order.email}</div>
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-white">{formatBaht(order.amount)}</td>
                <td className="px-4 py-3 text-gray-300">
                  {order.slipUploadedAt ? formatDateTime(order.slipUploadedAt) : "—"}
                  {order.status === "SLIP_SUBMITTED" && !order.adminNotifiedAt && (
                    <span className="mt-1 flex items-center gap-1 text-xs text-signal" title="ส่งแจ้งเตือน Telegram ไม่สำเร็จ">
                      <BellOff className="w-3 h-3" aria-hidden="true" /> ยังไม่ได้แจ้งเตือน
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <AdminOrderBadge status={order.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={pageSize} total={total} href={(target) => tabHref(tab, q, target)} />
    </div>
  );
}
