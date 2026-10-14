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
  "flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm text-fg transition-colors hover:bg-fg/[0.06] hover:text-gold-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-ink";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin?callbackUrl=/account");

  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className={`${displayFont.variable} ${thaiFont.variable} font-thai min-h-screen bg-page text-fg flex flex-col selection:bg-gold selection:text-fg`}>
      <header className="sticky top-0 z-40 border-b border-line bg-page/90 backdrop-blur supports-[backdrop-filter]:bg-page/85">
        <div className="flex h-16 lg:h-[72px] items-stretch">
          <div className="flex items-center gap-3 px-4 sm:px-6 lg:px-8">
            <BrandMark />
            <span className="hidden xl:inline border border-line px-2 py-0.5 text-[11px] font-semibold tracking-wide text-gold-ink rounded-full">PORTAL</span>
          </div>

          {/* จอ 1024px ขึ้นไป: เมนูอยู่ในแถบบน (ชื่อแบรนด์ยาว จอที่แคบกว่านี้ใช้แถบปุ่มใต้ header แทน) */}
          <nav aria-label="เมนูบัญชี" className="hidden lg:flex items-center gap-1">
            {ACCOUNT_NAV.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={navCell}>
                <Icon className="w-4 h-4 text-gold-ink" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex-1" />

          {isAdmin && (
            <Link
              href="/admin"
              title="ระบบจัดการหลังบ้าน"
              className="mr-1 flex items-center gap-1.5 self-center whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"
            >
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
              {/* จอแคบเหลือแค่ไอคอน แต่ข้อความยังอยู่ให้โปรแกรมอ่านหน้าจอ */}
              <span className="sr-only xl:not-sr-only">ระบบจัดการหลังบ้าน</span>
            </Link>
          )}

          <div className="hidden xl:flex flex-col justify-center px-4 text-right">
            <span className="max-w-[180px] truncate text-sm font-medium text-fg">{session.user.name || session.user.email}</span>
            <span className="text-xs text-fg-subtle">{isAdmin ? "แอดมิน" : "สมาชิก"}</span>
          </div>

          <div className="flex items-center px-3 sm:px-4">
            <AccountSignOutButton />
          </div>
        </div>

        {/* จอเล็กกว่า 1024px: เมนูบัญชีเป็นปุ่มมุมโค้ง 3 ปุ่มใต้ header */}
        <nav aria-label="เมนูบัญชี" className="lg:hidden grid grid-cols-3 gap-1 px-2 pb-2">
          {ACCOUNT_NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`${navCell} flex-col gap-1 whitespace-normal rounded-xl px-2 py-2 text-center text-xs`}>
              <Icon className="w-4 h-4 text-gold-ink" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">{children}</main>
      <MotionToggle />

      <footer className="border-t border-line text-xs text-fg-subtle">
        {/* pb-20: เว้นที่ให้ปุ่มหยุดภาพเคลื่อนไหว (fixed มุมซ้ายล่าง) ไม่ทับข้อความตอนเลื่อนถึงท้ายหน้า */}
        <div className="flex flex-col gap-3 px-4 sm:px-6 lg:px-8 pt-6 pb-20 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/" className="hover:text-gold-ink transition-colors">
              หน้าแรก
            </Link>
            <Link href="/guide" className="hover:text-gold-ink transition-colors">
              คู่มือการใช้งาน
            </Link>
            <Link href="/terms" className="hover:text-gold-ink transition-colors">
              เงื่อนไข
            </Link>
            <Link href="/privacy" className="hover:text-gold-ink transition-colors">
              ความเป็นส่วนตัว
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
