import { Fragment } from "react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { MAIN_NAV } from "@/config/marketing";
import { indexStyle } from "@/lib/motion";
import { HeaderAuth } from "./header-auth";
import { MobileNav } from "./mobile-nav";

const graphemes = (text: string) => Array.from(new Intl.Segmenter("th", { granularity: "grapheme" }).segment(text), (part) => part.segment);

/**
 * ตัวอักษรของโลโก้ขนาดใหญ่ — แยกทีละคำ (ตัดบรรทัดได้ระหว่างคำเมื่อพื้นที่แคบ) และทีละตัวอักษร (คลื่นเมื่อชี้)
 * ลำดับ --i ต่อเนื่องข้ามคำ คลื่นจึงไหลจากซ้ายไปขวาทั้งชื่อ
 */
function WaveWordmark({ text }: { text: string }) {
  let letterIndex = 0;
  return (
    <>
      {text.split(" ").map((word, wordIndex) => (
        <Fragment key={`${word}-${wordIndex}`}>
          {wordIndex > 0 && " "}
          <span className="inline-block whitespace-nowrap">
            {graphemes(word).map((letter) => {
              const index = letterIndex++;
              return (
                <span key={`${letter}-${index}`} style={indexStyle(index)}>
                  {letter}
                </span>
              );
            })}
          </span>
        </Fragment>
      ))}
    </>
  );
}

/** โลโก้ตัวอักษร (wordmark) + จุดสีเขียวสัญญาณ — ขนาดใหญ่ (ท้ายหน้า) ตัวอักษรเป็นคลื่นเมื่อชี้ และตัดบรรทัดระหว่างคำเมื่อคอลัมน์แคบ */
export function BrandMark({ size = "md" }: { size?: "md" | "xl" }) {
  const isLarge = size === "xl";
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-2 shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-ink"
      aria-label={`${siteConfig.name} หน้าแรก`}
    >
      <span
        aria-hidden="true"
        className={`shrink-0 rounded-[30%] bg-gold transition-transform duration-500 group-hover:rotate-[135deg] ${isLarge ? "w-5 h-5 sm:w-7 sm:h-7" : "w-2.5 h-2.5"}`}
      />
      {isLarge ? (
        <span className="mx-wave min-w-0 font-display text-4xl font-bold leading-[1.05] tracking-tight text-fg sm:text-6xl lg:text-5xl xl:text-6xl 2xl:text-7xl">
          <WaveWordmark text={siteConfig.shortName} />
        </span>
      ) : (
        <span className="font-display text-xl font-bold tracking-tight text-fg whitespace-nowrap">{siteConfig.shortName}</span>
      )}
    </Link>
  );
}

/** แถบเมนูแบบกรอบเส้น (แต่ละเมนูเป็นช่องของตัวเอง) — จอเล็กกว่า lg ใช้เมนูแบบเปิด/ปิด */
export function SiteHeader() {
  return (
    <header data-site-header="" className="sticky top-0 z-50 border-b border-line bg-page/90 backdrop-blur supports-[backdrop-filter]:bg-page/85">
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
              className="rounded-full px-4 py-2 text-sm text-fg transition-colors hover:bg-fg/[0.06] hover:text-gold-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-ink"
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
