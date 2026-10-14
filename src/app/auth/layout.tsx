import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { BrandMark } from "@/components/marketing/site-header";
import { displayFont, thaiFont } from "@/components/marketing/fonts";
import { HeroChart } from "@/components/marketing/hero-chart";
import { HERO_CONTENT } from "@/config/marketing";
import { loadDelayStyle as loadDelay } from "@/lib/motion";
import { MotionToggle } from "@/components/motion/motion-toggle";

/**
 * หน้าเข้าสู่ระบบ/สมัคร/ลืมรหัส — กรอบเส้นแบบหน้าบ้าน: ซ้ายเป็นแผงแบรนด์ (จอใหญ่) ขวาเป็นฟอร์ม
 * อนิเมชันเบา ๆ ตอนโหลด: แผงแบรนด์ลอยขึ้น กราฟวาดตัวเอง ฟอร์มตามมา (ปิดเองเมื่อผู้ใช้ตั้งค่าลดการเคลื่อนไหว)
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mx-scope ${displayFont.variable} ${thaiFont.variable} font-thai min-h-screen bg-page text-fg flex flex-col selection:bg-gold selection:text-fg`}>
      <header className="flex h-16 items-stretch border-b border-line">
        <div className="flex items-center px-4 sm:px-6 lg:px-8">
          <BrandMark />
        </div>
        <div className="flex-1" />
        <Link
          href="/"
          className="mr-3 sm:mr-5 flex items-center gap-2 self-center rounded-full px-4 py-2 text-sm text-fg transition-colors hover:bg-fg/[0.06] hover:text-gold-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-ink"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          กลับหน้าแรก
        </Link>
      </header>

      <div className="flex-1 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <aside aria-hidden="true" className="hidden lg:flex flex-col justify-between gap-10 border-r border-line bg-surface p-10 xl:p-14">
          <p className="mx-load font-display text-5xl xl:text-6xl font-bold tracking-tight leading-[1.05]">
            {HERO_CONTENT.titleLead}
            <span className="block text-gold-ink">{HERO_CONTENT.titleHighlight}</span>
          </p>
          <HeroChart animated className="w-full h-auto" />
          <ul className="mx-load grid gap-px bg-line border border-line rounded-2xl overflow-hidden" style={loadDelay(500)}>
            {HERO_CONTENT.highlights.map((item) => (
              <li key={item} className="flex items-start gap-2.5 bg-surface px-4 py-3 text-sm text-fg">
                <Check className="w-4 h-4 mt-0.5 shrink-0 text-gold-ink" />
                {item}
              </li>
            ))}
          </ul>
        </aside>

        <main className="mx-load flex items-start justify-center px-4 sm:px-6 py-10 sm:py-16 lg:items-center" style={loadDelay(150)}>
          {children}
        </main>
      </div>
      <MotionToggle />
    </div>
  );
}
