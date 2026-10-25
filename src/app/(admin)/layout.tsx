import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Activity, ClipboardCheck, ExternalLink, FileUp, Handshake, LayoutDashboard, ScrollText, Sliders, Users } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminActor } from "@/lib/admin/guard";
import { formatDateTime } from "@/lib/format";
import { AccountSignOutButton } from "@/components/account-sign-out";
import { BrandMark } from "@/components/marketing/site-header";
import { displayFont, thaiFont } from "@/components/marketing/fonts";

const ADMIN_NAV = [
  { href: "/admin", label: "ภาพรวมระบบ", icon: LayoutDashboard },
  { href: "/admin/orders", label: "ตรวจสอบออเดอร์", icon: ClipboardCheck },
  { href: "/admin/broker-claims", label: "คำขอสิทธิ์ IB", icon: Handshake },
  { href: "/admin/broker-claims/import", label: "นำเข้ารายงาน IB", icon: FileUp },
  { href: "/admin/members", label: "สมาชิก & สิทธิ์", icon: Users },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/status", label: "สถานะระบบ", icon: Activity },
  { href: "/admin/settings", label: "ตั้งค่า & Kill-switch", icon: Sliders },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin?callbackUrl=/admin");

  // ตรวจ role จากฐานข้อมูลด้วย (JWT อาจเก่า เช่น แอดมินถูกลดสิทธิ์แล้วแต่ token ยังไม่หมดอายุ)
  if (session.user.role !== "ADMIN" || !(await getAdminActor(prisma, session.user.id))) {
    redirect("/account?error=unauthorized_admin");
  }

  return (
    <div className={`${displayFont.variable} ${thaiFont.variable} font-thai min-h-screen bg-page text-fg flex flex-col md:flex-row selection:bg-gold selection:text-fg`}>
      <aside className="flex w-full shrink-0 flex-col border-b border-line md:sticky md:top-0 md:h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="flex h-16 items-center justify-between gap-2 border-b border-line px-4">
          <BrandMark />
          <span className="border border-red-500/50 px-2 py-0.5 text-[11px] font-bold tracking-wider text-red-700 rounded-full">ADMIN</span>
        </div>

        <nav aria-label="เมนูผู้ดูแลระบบ" className="flex gap-1 overflow-x-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-1 md:flex-col md:overflow-visible md:p-3">
          {ADMIN_NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-4 py-3 text-sm text-fg transition-colors hover:bg-fg/[0.05] hover:text-gold-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-ink"
            >
              <Icon className="w-4 h-4 text-gold-ink" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block space-y-3 border-t border-line px-5 py-4 text-xs">
          <div>
            <span className="block text-fg-subtle">ผู้ดูแลระบบ</span>
            <span className="block truncate font-medium text-fg">{session.user.email}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Link href="/account" className="flex items-center gap-1 text-fg-subtle transition-colors hover:text-gold-ink">
              <ExternalLink className="w-3 h-3" aria-hidden="true" /> หน้าสมาชิก
            </Link>
            <AccountSignOutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-line px-4 sm:px-6 lg:px-8 py-3 text-xs">
          <p className="flex items-center gap-2 text-fg-muted">
            <span aria-hidden="true" className="w-2 h-2 bg-red-400 rounded-full" />
            โซนผู้ดูแลระบบ — ทุกการเปลี่ยนแปลงถูกบันทึกใน Audit Log
          </p>
          <p className="text-fg-subtle">
            เวลาไทย {formatDateTime(new Date())}
            <span className="md:hidden">
              {" · "}
              <Link href="/account" className="text-fg-muted underline underline-offset-2 hover:text-gold-ink">
                หน้าสมาชิก
              </Link>
            </span>
          </p>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
