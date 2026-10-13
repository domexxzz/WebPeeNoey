import Link from "next/link";
import { siteConfig } from "@/config/site";
import { MAIN_NAV } from "@/config/marketing";
import { indexStyle } from "@/lib/motion";
import { HeaderAuth } from "./header-auth";
import { MobileNav } from "./mobile-nav";

/** โลโก้ตัวอักษร (wordmark) + จุดสีเขียวสัญญาณ — ขนาดใหญ่ (ท้ายหน้า) ตัวอักษรเป็นคลื่นเมื่อชี้ */
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
        className={`rounded-[30%] bg-signal transition-transform duration-500 group-hover:rotate-[135deg] ${isLarge ? "w-5 h-5 sm:w-7 sm:h-7" : "w-2.5 h-2.5"}`}
      />
      <span
        className={`font-display font-bold tracking-tight text-white whitespace-nowrap ${
          isLarge ? "mx-wave text-4xl sm:text-6xl lg:text-7xl leading-none" : "text-xl"
        }`}
      >
        {isLarge
          ? Array.from(new Intl.Segmenter("th", { granularity: "grapheme" }).segment(siteConfig.shortName), (part) => part.segment).map((letter, index) => (
              <span key={`${letter}-${index}`} style={indexStyle(index)}>
                {/* ช่องว่างใน span แบบ inline-block จะหายไป ต้องใช้ช่องว่างแบบไม่ตัดบรรทัด */}
                {letter === " " ? "\u00A0" : letter}
              </span>
            ))
          : siteConfig.shortName}
      </span>
    </Link>
  );
}

/** แถบเมนูแบบกรอบเส้น (แต่ละเมนูเป็นช่องของตัวเอง) — จอเล็กกว่า lg ใช้เมนูแบบเปิด/ปิด */
export function SiteHeader() {
  return (
    <header data-site-header="" className="sticky top-0 z-50 border-b border-line bg-ink/95 backdrop-blur supports-[backdrop-filter]:bg-ink/85">
      <div className="relative flex h-16 lg:h-[72px] items-stretch">
        <div className="flex items-center px-4 sm:px-6 lg:px-8">
          <BrandMark />
        </div>

        <div className="flex-1" />

        <nav aria-label="เมนูหลัก" className="hidden lg:flex items-center gap-1">
          {MAIN_NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm text-gray-200 transition-colors hover:bg-white/[0.07] hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 px-3 sm:px-4 lg:px-6">
          <HeaderAuth />
          <MobileNav links={MAIN_NAV} />
        </div>
      </div>
    </header>
  );
}
