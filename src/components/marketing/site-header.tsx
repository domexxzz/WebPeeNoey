import Link from "next/link";
import { siteConfig } from "@/config/site";
import { MAIN_NAV } from "@/config/marketing";
import { HeaderAuth } from "./header-auth";
import { MobileNav } from "./mobile-nav";

export function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label={`${siteConfig.name} หน้าแรก`}>
      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-black shadow-glow">
        P
      </span>
      {/* จอแคบ (< 640px) ใช้ชื่อสั้น เพื่อให้ปุ่มสมัครและเมนูไม่ถูกบีบ */}
      <span className="font-bold text-lg sm:text-xl text-white tracking-tight whitespace-nowrap">
        <span className="sm:hidden">{siteConfig.shortName}</span>
        <span className="hidden sm:inline">{siteConfig.name}</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-[#111827]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <BrandMark />

        <nav aria-label="เมนูหลัก" className="hidden md:flex items-center gap-5 lg:gap-6 text-sm text-gray-300">
          {MAIN_NAV.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-amber-400 transition-colors">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <HeaderAuth />
          <MobileNav links={MAIN_NAV} />
        </div>
      </div>
    </header>
  );
}
