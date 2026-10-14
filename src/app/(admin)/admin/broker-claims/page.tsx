import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BellOff, Search } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/page-guard";
import { prisma } from "@/lib/prisma";
import { formatDateTime, parsePage } from "@/lib/format";
import { BROKERS, BROKER_IB_RULES } from "@/config/broker-ib";
import { BROKER_CLAIM_TABS, listBrokerClaims, parseBrokerClaimTab, type BrokerClaimTab } from "@/lib/broker-ib/admin-query";
import { AdminOrderBadge, AdminPageHeader, inputClass, Pagination } from "@/components/admin/admin-ui";

export const metadata: Metadata = { title: "คำขอสิทธิ์ผ่าน IB", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}

function tabHref(tab: BrokerClaimTab, q?: string, page?: number) {
  const params = new URLSearchParams({ tab });
  if (q) params.set("q", q);
  if (page && page > 1) params.set("page", String(page));
  return `/admin/broker-claims?${params.toString()}`;
}

export default async function AdminBrokerClaimsPage({ searchParams }: PageProps) {
  const query = await searchParams;
  await requireAdminPage();
  const tab = parseBrokerClaimTab(query.tab);
  const q = query.q?.trim().slice(0, 100) || undefined;
  const page = parsePage(query.page);
  const { items, total, counts, pageSize } = await listBrokerClaims(prisma, { tab, q, page });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="คำขอสิทธิ์ผ่าน IB"
        description={`ตรวจบัญชีใน Partner Portal ของโบรกเกอร์ตามลำดับเวลาที่ยื่น (เก่าสุดก่อน) — คำขอที่รอเกิน ${BROKER_IB_RULES.claimReviewOverdueHours} ชั่วโมงถูกไฮไลต์`}
      >
        <form role="search" className="flex gap-2" action="/admin/broker-claims">
          <input type="hidden" name="tab" value={tab} />
          <label className="sr-only" htmlFor="claim-search">ค้นหาคำขอ</label>
          <input id="claim-search" name="q" defaultValue={q} placeholder="เลขคำขอ / อีเมล / เลขบัญชีเทรด" className={`${inputClass} sm:w-72`} />
          <button type="submit" className="bg-fg/10 px-3 text-fg hover:bg-fg/15" aria-label="ค้นหา">
            <Search className="w-4 h-4" aria-hidden="true" />
          </button>
        </form>
      </AdminPageHeader>

      <nav aria-label="สถานะคำขอ" className="flex flex-wrap gap-2">
        {(Object.keys(BROKER_CLAIM_TABS) as BrokerClaimTab[]).map((key) => (
          <Link
            key={key}
            href={tabHref(key, q)}
            aria-current={key === tab ? "page" : undefined}
            className={`border px-3.5 py-1.5 text-xs font-medium transition-colors rounded-xl ${
              key === tab ? "border-gold bg-gold text-fg" : "border-line text-fg-muted hover:bg-fg/5"
            }`}
          >
            {BROKER_CLAIM_TABS[key].label} <span className="ml-1 tabular-nums opacity-70">{counts[key]}</span>
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto border border-line bg-surface rounded-2xl">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-fg-subtle">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-medium">คำขอ</th>
              <th className="px-4 py-3 font-medium">สมาชิก</th>
              <th className="px-4 py-3 font-medium">บัญชีเทรด</th>
              <th className="px-4 py-3 font-medium">ยื่นเมื่อ</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-fg-subtle">
                  ไม่มีคำขอในหมวดนี้
                </td>
              </tr>
            )}
            {items.map((claim) => (
              <tr key={claim.id} className={claim.overdue ? "bg-orange-500/10" : "hover:bg-fg/5"}>
                <td className="px-4 py-3">
                  <Link href={`/admin/broker-claims/${claim.id}`} className="font-mono text-gold-ink hover:underline">
                    {claim.orderNumber}
                  </Link>
                  {claim.isRenewal && <div className="text-xs text-fg-subtle">ต่ออายุ</div>}
                </td>
                <td className="px-4 py-3 text-fg">{claim.email}</td>
                <td className="px-4 py-3 font-mono text-fg">
                  {claim.broker ? `${BROKERS[claim.broker].label} ${claim.platform} ${claim.accountNumber}` : "—"}
                </td>
                <td className="px-4 py-3 text-fg-muted">
                  {formatDateTime(claim.createdAt)}
                  {claim.overdue && (
                    <span className="mt-1 flex items-center gap-1 text-xs text-orange-800">
                      <AlertTriangle className="w-3 h-3" aria-hidden="true" /> รอนานเกินกำหนด
                    </span>
                  )}
                  {claim.status === "CLAIM_SUBMITTED" && !claim.adminNotifiedAt && (
                    <span className="mt-1 flex items-center gap-1 text-xs text-gold-ink" title="ส่งแจ้งเตือน Telegram ไม่สำเร็จ">
                      <BellOff className="w-3 h-3" aria-hidden="true" /> ยังไม่ได้แจ้งเตือน
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <AdminOrderBadge status={claim.status} />
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
