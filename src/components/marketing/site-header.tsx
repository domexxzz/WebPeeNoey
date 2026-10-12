import Link from "next/link";
import { siteConfig } from "@/config/site";
import { MAIN_NAV } from "@/config/marketing";
import { HeaderAuth } from "./header-auth";
import { MobileNav } from "./mobile-nav";

/** โลโก้ตัวอักษร (wordmark) + จุดสีเขียวสัญญาณ */
export function BrandMark({ size = "md" }: { size?: "md" | "xl" }) {
  const isLarge = size === "xl";
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-2 shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
      aria-label={`${siteConfig.name} หน้าแรก`}
    >
      <span
        aria-hidden="true"
        className={`bg-signal transition-transform group-hover:rotate-45 ${isLarge ? "w-5 h-5 sm:w-7 sm:h-7" : "w-2.5 h-2.5"}`}
      />
      <span
        className={`font-display font-bold tracking-tight text-white whitespace-nowrap ${
          isLarge ? "text-5xl sm:text-7xl leading-none" : "text-xl"
        }`}
      >
        {siteConfig.shortName}
      </span>
    </Link>
  );
}

/** แถบเมนูแบบกรอบเส้น (แต่ละเมนูเป็นช่องของตัวเอง) — จอเล็กกว่า lg ใช้เมนูแบบเปิด/ปิด */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink/95 backdrop-blur supports-[backdrop-filter]:bg-ink/85">
      <div className="relative flex h-16 lg:h-[72px] items-stretch">
        <div className="flex items-center px-4 sm:px-6 lg:px-8 lg:border-r lg:border-line">
          <BrandMark />
        </div>

        <div className="flex-1" />

        <nav aria-label="เมนูหลัก" className="hidden lg:flex items-stretch">
          {MAIN_NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center border-l border-line px-4 xl:px-6 text-sm text-gray-200 transition-colors hover:bg-white/[0.04] hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 px-3 sm:px-4 lg:border-l lg:border-line lg:px-5">
          <HeaderAuth />
          <MobileNav links={MAIN_NAV} />
        </div>
      </div>
    </header>
  );
}
