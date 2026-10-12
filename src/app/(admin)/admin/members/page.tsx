import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/page-guard";
import Link from "next/link";
import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { daysUntil, formatDate, parsePage } from "@/lib/format";
import { searchMembers } from "@/lib/admin/members";
import { AdminPageHeader, inputClass, Pagination } from "@/components/admin/admin-ui";

export const metadata: Metadata = { title: "สมาชิก", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminMembersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const query = await searchParams;
  await requireAdminPage();
  const q = query.q?.trim().slice(0, 100) || undefined;
  const page = parsePage(query.page);
  const now = new Date();
  const { items, total, pageSize } = await searchMembers(prisma, { q, page, now });
  const href = (target: number) => `/admin/members?${new URLSearchParams({ ...(q ? { q } : {}), page: String(target) }).toString()}`;

  return (
    <div className="space-y-6">
      <AdminPageHeader title="สมาชิก" description="ค้นหาด้วยอีเมล ชื่อ TradingView Username หรือ Discord User ID">
        <form role="search" className="flex gap-2" action="/admin/members">
          <label className="sr-only" htmlFor="member-search">ค้นหาสมาชิก</label>
          <input id="member-search" name="q" defaultValue={q} placeholder="ค้นหาสมาชิก" className={`${inputClass} sm:w-72`} />
          <button type="submit" className="bg-white/10 px-3 text-gray-200 hover:bg-white/20" aria-label="ค้นหา">
            <Search className="w-4 h-4" aria-hidden="true" />
          </button>
        </form>
      </AdminPageHeader>

      <div className="overflow-x-auto border border-line bg-ink">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="text-left text-xs text-gray-400">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-medium">สมาชิก</th>
              <th className="px-4 py-3 font-medium">TradingView</th>
              <th className="px-4 py-3 font-medium">สถานะสิทธิ์</th>
              <th className="px-4 py-3 font-medium">สมัครเมื่อ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-400">ไม่พบสมาชิก</td>
              </tr>
            )}
            {items.map((member) => (
              <tr key={member.id} className="hover:bg-white/5">
                <td className="px-4 py-3">
                  <Link href={`/admin/members/${member.id}`} className="text-signal hover:underline">{member.email}</Link>
                  <div className="text-xs text-gray-400">{member.name ?? "—"}{member.role === "ADMIN" && " · แอดมิน"}</div>
                </td>
                <td className="px-4 py-3 text-gray-300">{member.tradingViewUsername ?? "—"}</td>
                <td className="px-4 py-3">
                  {member.membership.active && member.membership.endsAt ? (
                    <span className="text-signal">ใช้งานได้ถึง {formatDate(member.membership.endsAt)} (อีก {daysUntil(member.membership.endsAt, now)} วัน)</span>
                  ) : (
                    <span className="text-gray-400">ไม่มีสิทธิ์</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400">{formatDate(member.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={pageSize} total={total} href={href} />
    </div>
  );
}
