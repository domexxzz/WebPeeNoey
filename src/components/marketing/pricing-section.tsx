import Link from "next/link";
import { ArrowRight, Check, Info } from "lucide-react";
import { PROMO_SETTINGS, SITE_PLANS, formatTHB, type PlanConfig } from "@/config/plans";
import { HOME_SECTION_IDS, RISK_DISCLAIMER } from "@/config/marketing";
import { staggerStyle } from "@/lib/motion";
import { SectionHeading } from "./section-heading";

export function getPlanCtaHref(plan: PlanConfig): string {
  // ผู้ที่ยังไม่ล็อกอินจะถูก middleware พาไปเข้าสู่ระบบ/สมัคร แล้วกลับมาหน้านี้อัตโนมัติ
  return `/checkout/${encodeURIComponent(plan.slug)}`;
}

/**
 * กล่องราคาเหลื่อมขึ้นลงสลับกันบนจอใหญ่ (จังหวะแบบเดียวกับกล่องจุดเด่นในต้นแบบ)
 * li รับตำแหน่งเหลื่อม (transform) ส่วนกล่องข้างในรับอนิเมชันเผย (translate) + เอียงตามเมาส์ (transform) จึงไม่ชนกัน
 * แพ็กเกจยอดนิยมมีเส้นแสงวิ่งรอบขอบ (.mx-beam-frame) และป้ายมีประกาย (.mx-shimmer)
 */
const STAGGER = ["lg:translate-y-0", "lg:translate-y-6", "lg:-translate-y-2", "lg:translate-y-4"];

function PlanCard({ plan, index }: { plan: PlanConfig; index: number }) {
  const featured = Boolean(plan.popular);
  return (
    <li data-plan={plan.slug} className={`flex ${STAGGER[index % STAGGER.length]}`}>
      <div data-reveal="up" style={staggerStyle(index, 110)} className="flex w-full">
      <div
        data-tilt=""
        data-spotlight=""
        className={`relative flex w-full flex-col border p-6 sm:p-7 rounded-2xl ${
          featured
            ? "border-gold bg-gold text-fg [--spot-color:rgba(255,255,255,0.45)]"
            : "border-line bg-surface text-fg hover:border-gold"
        }`}
      >
      {featured && (
        <span aria-hidden="true" className="mx-beam-frame">
          <span className="mx-beam-spin" />
        </span>
      )}
      {plan.badge && (
        <span
          className={`absolute -top-3 left-6 px-2.5 py-1 text-xs font-bold tracking-wide ${featured ? "mx-shimmer bg-surface text-gold-ink" : "bg-gold text-fg"}`}
        >
          {plan.badge}
        </span>
      )}

      <h3 className="font-display text-xl font-bold tracking-tight">{plan.name}</h3>
      <p className={`mt-1 min-h-[40px] text-sm leading-relaxed ${featured ? "text-fg/75" : "text-fg-subtle"}`}>{plan.description}</p>

      <div className={`mt-6 border-t pt-5 ${featured ? "border-fg/25" : "border-line-soft"}`}>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-4xl font-bold tracking-tight tabular-nums">{formatTHB(plan.price)}</span>
          {plan.originalPrice > plan.price && (
            <span className={`text-sm line-through ${featured ? "text-fg/60" : "text-fg-subtle"}`}>{formatTHB(plan.originalPrice)}</span>
          )}
        </div>
        <span className={`mt-1 block text-xs ${featured ? "text-fg/70" : "text-fg-subtle"}`}>อายุการใช้งาน {plan.durationLabel}</span>
      </div>

      <ul className="mt-6 flex-1 space-y-2.5">
        {plan.features.map((feature) => (
          <li key={feature} className={`flex items-start gap-2 text-sm leading-relaxed ${featured ? "text-fg/85" : "text-fg-muted"}`}>
            <Check className={`w-4 h-4 mt-0.5 shrink-0 ${featured ? "text-fg" : "text-gold-ink"}`} aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={getPlanCtaHref(plan)}
        aria-label={`เลือกแพ็กเกจนี้: ${plan.name} ราคา ${formatTHB(plan.price)}`}
        className={`mx-shine group/cta mt-8 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
          featured
            ? "bg-surface text-gold-ink hover:bg-surface focus-visible:outline-fg"
            : "border border-line text-fg hover:bg-gold hover:text-fg hover:border-gold focus-visible:outline-gold-ink rounded-xl"
        }`}
      >
        เลือกแพ็กเกจนี้
        <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover/cta:translate-x-1" aria-hidden="true" />
      </Link>
      </div>
      </div>
    </li>
  );
}

export function PricingSection() {
  return (
    <section aria-labelledby={`${HOME_SECTION_IDS.pricing}-heading`} id={HOME_SECTION_IDS.pricing} className="scroll-mt-20 border-b border-line">
      <div className="px-4 sm:px-6 lg:px-10 py-20 sm:py-28">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            id={`${HOME_SECTION_IDS.pricing}-heading`}
            eyebrow="แพ็กเกจและราคา"
            title="เลือกระยะเวลา ที่เหมาะกับคุณ"
            description="ชำระครั้งเดียวต่อรอบผ่าน PromptPay ไม่มีการตัดเงินอัตโนมัติ"
          />
          <div data-reveal="left" style={staggerStyle(3, 110)} className="flex max-w-md border border-line rounded-2xl overflow-hidden">
            <span aria-hidden="true" className="w-2 shrink-0 bg-gold" />
            <div className="px-5 py-4">
              <p className="font-display font-bold text-fg">{PROMO_SETTINGS.promoTitle}</p>
              <p className="mt-1 text-sm text-fg-muted leading-relaxed">{PROMO_SETTINGS.promoSubtitle}</p>
            </div>
          </div>
        </div>

        <ul data-loop="" className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:pb-6">
          {SITE_PLANS.map((plan, index) => (
            <PlanCard key={plan.id} plan={plan} index={index} />
          ))}
        </ul>

        <div data-reveal="up" className="mt-14 grid gap-px bg-line border border-line md:grid-cols-[1.6fr_1fr] rounded-2xl overflow-hidden">
          <p className="bg-surface px-5 py-4 text-xs sm:text-sm text-fg-subtle leading-relaxed">{RISK_DISCLAIMER}</p>
          <p className="flex items-start gap-2 bg-surface px-5 py-4 text-xs sm:text-sm text-fg-muted leading-relaxed">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-gold-ink" aria-hidden="true" />
            <span>
              ก่อนชำระเงิน โปรดอ่าน{" "}
              <Link href="/terms" className="underline underline-offset-4 hover:text-gold-ink">
                ข้อกำหนดการใช้บริการ
              </Link>{" "}
              และ{" "}
              <Link href="/refund" className="underline underline-offset-4 hover:text-gold-ink">
                นโยบายการคืนเงิน
              </Link>
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
