import { buildOrganizationJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/json-ld";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { displayFont, thaiFont } from "@/components/marketing/fonts";
import { MotionRuntime } from "@/components/motion/motion-runtime";
import { MotionToggle } from "@/components/motion/motion-toggle";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`mx-scope ${displayFont.variable} ${thaiFont.variable} font-thai min-h-screen bg-ink text-white flex flex-col selection:bg-signal selection:text-ink`}
    >
      <MotionRuntime />
      <div aria-hidden="true" className="mx-progress" />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:bg-signal focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>
      <JsonLd data={buildOrganizationJsonLd()} />
      <SiteHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <MotionToggle />
    </div>
  );
}
