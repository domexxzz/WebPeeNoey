import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { LayoutDashboard, Receipt, ShieldAlert, Tags } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { AccountSignOutButton } from "@/components/account-sign-out";
import { BrandMark } from "@/components/marketing/site-header";
import { displayFont, thaiFont } from "@/components/marketing/fonts";
import { MotionToggle } from "@/components/motion/motion-toggle";

const ACCOUNT_NAV = [
  { href: "/account", label: "แดชบอร์ด", icon: LayoutDashboard },
  { href: "/account/orders", label: "ประวัติคำสั่งซื้อ", icon: Receipt },
  { href: "/#pricing", label: "แพ็กเกจ / ต่ออายุ", icon: Tags },
] as const;

const navCell =
  "flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm text-gray-200 transition-colors hover:bg-white/[0.07] hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin?callbackUrl=/account");

  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className={`${displayFont.variable} ${thaiFont.variable} font-thai min-h-screen bg-ink text-white flex flex-col selection:bg-signal selection:text-ink`}>
      <header className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur supports-[backdrop-filter]:bg-ink/85">
        <div className="flex h-16 lg:h-[72px] items-stretch">
          <div className="flex items-center gap-3 px-4 sm:px-6 lg:px-8">
            <BrandMark />
            <span className="hidden sm:inline border border-line px-2 py-0.5 text-[11px] font-semibold tracking-wide text-signal rounded-full">PORTAL</span>
          </div>

          <nav aria-label="เมนูบัญชี" className="hidden md:flex items-center gap-1">
            {ACCOUNT_NAV.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={navCell}>
                <Icon className="w-4 h-4 text-signal" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex-1" />

          {isAdmin && (
            <Link
              href="/admin"
              className="mr-1 flex items-center gap-1.5 self-center rounded-full px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"
            >
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">ระบบจัดการหลังบ้าน</span>
            </Link>
          )}

          <div className="hidden lg:flex flex-col justify-center px-4 text-right">
            <span className="max-w-[180px] truncate text-sm font-medium text-white">{session.user.name || session.user.email}</span>
            <span className="text-xs text-gray-400">{isAdmin ? "แอดมิน" : "สมาชิก"}</span>
          </div>

          <div className="flex items-center px-3 sm:px-4">
            <AccountSignOutButton />
          </div>
        </div>

        {/* จอเล็ก: เมนูบัญชีเป็นปุ่มมุมโค้ง 3 ปุ่มใต้ header */}
        <nav aria-label="เมนูบัญชี (มือถือ)" className="md:hidden grid grid-cols-3 gap-1 px-2 pb-2">
          {ACCOUNT_NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`${navCell} flex-col gap-1 rounded-xl px-2 py-2 text-xs`}>
              <Icon className="w-4 h-4 text-signal" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">{children}</main>
      <MotionToggle />

      <footer className="border-t border-line text-xs text-gray-400">
        <div className="flex flex-col gap-3 px-4 sm:px-6 lg:px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/" className="hover:text-signal transition-colors">
              หน้าแรก
            </Link>
            <Link href="/guide" className="hover:text-signal transition-colors">
              คู่มือการใช้งาน
            </Link>
            <Link href="/terms" className="hover:text-signal transition-colors">
              เงื่อนไข
            </Link>
            <Link href="/privacy" className="hover:text-signal transition-colors">
              ความเป็นส่วนตัว
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
