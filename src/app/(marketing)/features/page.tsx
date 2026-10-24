import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldAlert } from "lucide-react";
import { FEATURES, HOME_SECTION_IDS, IMAGE_SLOTS, RISK_DISCLAIMER } from "@/config/marketing";
import { FEATURE_DETAILS } from "@/content/features";
import { buildBreadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/json-ld";
import { FEATURE_ICONS } from "@/components/marketing/features-section";
import { ImageSlot } from "@/components/marketing/image-slot";
import { PageHeader } from "@/components/marketing/page-header";

export const metadata: Metadata = buildPageMetadata({
  title: "ฟีเจอร์และสิ่งที่ได้รับ",
  description:
    "รายละเอียดสิทธิ์สมาชิก: อินดิเคเตอร์ Invite-only บน TradingView กลุ่ม Telegram VIP คอมมูนิตี้ Discord คู่มือ และทีมช่วยเหลือ",
  path: "/features",
});

const detailedIds = new Set(FEATURE_DETAILS.map((detail) => detail.feature.id));
const OTHER_FEATURES = FEATURES.filter((feature) => !detailedIds.has(feature.id));

export default function FeaturesPage() {
  return (
    <>
      <JsonLd data={buildBreadcrumbJsonLd([{ name: "ฟีเจอร์และสิ่งที่ได้รับ", path: "/features" }])} />
      <PageHeader
        eyebrow="ฟีเจอร์"
        title="ทุกสิ่ง ที่รวมอยู่ในสมาชิก"
        description="สิทธิ์ทุกช่องทางเปิดและปิดตามอายุสมาชิกโดยอัตโนมัติ ติดตามสถานะได้จากแดชบอร์ดสมาชิกที่เดียว"
      >
        <nav aria-label="ฟีเจอร์ในหน้านี้" className="mt-8 flex flex-wrap gap-2">
          {FEATURE_DETAILS.map(({ feature }) => (
            <a
              key={feature.id}
              href={`#${feature.id}`}
              className="px-3.5 py-1.5 border border-line text-xs text-fg-muted hover:border-gold hover:text-gold-ink transition-colors rounded-xl"
            >
              {feature.title}
            </a>
          ))}
        </nav>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-20 sm:space-y-28">
        {FEATURE_DETAILS.map(({ feature, bullets, imageAlt }, index) => {
          const Icon = FEATURE_ICONS[feature.icon];
          const isReversed = index % 2 === 1;
          return (
            <section
              key={feature.id}
              id={feature.id}
              aria-labelledby={`${feature.id}-heading`}
              className="scroll-mt-24 grid gap-10 lg:grid-cols-2 lg:items-center"
            >
              <div className={isReversed ? "lg:order-2" : ""}>
                <span className="inline-flex w-12 h-12 items-center justify-center border border-line text-gold-ink rounded-xl">
                  <Icon className="w-6 h-6" aria-hidden="true" />
                </span>
                <h2 id={`${feature.id}-heading`} className="mt-5 font-display text-2xl sm:text-3xl font-bold text-fg">
                  {feature.title}
                </h2>
                <p className="mt-3 text-fg-muted leading-relaxed">{feature.description}</p>
                <ul className="mt-6 space-y-3">
                  {bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2.5 text-sm text-fg-muted leading-relaxed">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-gold-ink" aria-hidden="true" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={isReversed ? "lg:order-1" : ""}>
                <ImageSlot spec={IMAGE_SLOTS.featureScreenshot} alt={imageAlt} />
              </div>
            </section>
          );
        })}

        {OTHER_FEATURES.length > 0 && (
          <section aria-labelledby="other-features-heading">
            <h2 id="other-features-heading" className="font-display text-2xl font-bold text-fg">
              สิทธิ์อื่น ๆ สำหรับสมาชิก
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {OTHER_FEATURES.map((feature) => {
                const Icon = FEATURE_ICONS[feature.icon];
                return (
                  <li key={feature.id} className=" border border-line bg-surface p-6 rounded-2xl">
                    <Icon className="w-6 h-6 text-gold-ink" aria-hidden="true" />
                    <h3 className="mt-4 font-display font-semibold text-fg">{feature.title}</h3>
                    <p className="mt-2 text-sm text-fg-subtle leading-relaxed">{feature.description}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <aside aria-label="คำเตือนความเสี่ยง" className=" border border-line bg-surface p-6 flex items-start gap-3 rounded-2xl">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-gold-ink" aria-hidden="true" />
          <p className="text-sm text-fg-muted leading-relaxed">{RISK_DISCLAIMER}</p>
        </aside>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between border border-line bg-surface p-8 rounded-2xl">
          <div>
            <h2 className="font-display text-xl font-bold text-fg">พร้อมเริ่มใช้งานแล้วหรือยัง?</h2>
            <p className="mt-1 text-sm text-fg-muted">เลือกแพ็กเกจ หรืออ่านคู่มือการใช้งานก่อนตัดสินใจ</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/#${HOME_SECTION_IDS.pricing}`}
              className="px-6 py-3 text-sm font-semibold text-fg bg-gold hover:bg-gold-hover flex items-center justify-center gap-2 rounded-xl"
            >
              ดูแพ็กเกจราคา
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link href="/guide" className="px-6 py-3 text-sm font-medium text-fg border border-line bg-surface hover:bg-fg/10 text-center rounded-xl">
              อ่านคู่มือการใช้งาน
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
