import Link from "next/link";
import { ArrowRight, CheckCircle2, Info } from "lucide-react";
import { PROMO_SETTINGS, SITE_PLANS, formatTHB, type PlanConfig } from "@/config/plans";
import { HOME_SECTION_IDS, RISK_DISCLAIMER } from "@/config/marketing";
import { SectionHeading } from "./section-heading";

export function getPlanCtaHref(plan: PlanConfig): string {
  return `/auth/signup?plan=${encodeURIComponent(plan.slug)}`;
}

function PlanCard({ plan }: { plan: PlanConfig }) {
  return (
    <li
      data-plan={plan.slug}
      className={`relative rounded-2xl p-6 border flex flex-col transition-all ${
        plan.popular
          ? "glass-panel-gold border-amber-500/50 shadow-glow lg:-translate-y-3"
          : "glass-panel border-white/10 hover:border-white/20"
      }`}
    >
      {plan.badge && (
        <span className="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-amber-500 text-black text-[11px] font-bold tracking-wide">
          {plan.badge}
        </span>
      )}

      <h3 className="font-heading text-lg font-bold text-white">{plan.name}</h3>
      <p className="text-xs text-gray-400 mt-1 min-h-[32px] leading-relaxed">{plan.description}</p>

      <div className="mt-5 mb-6">
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-3xl font-bold text-amber-400">{formatTHB(plan.price)}</span>
          {plan.originalPrice > plan.price && (
            <span className="text-sm text-gray-400 line-through">{formatTHB(plan.originalPrice)}</span>
          )}
        </div>
        <span className="text-xs text-gray-400 block mt-1">อายุการใช้งาน {plan.durationLabel}</span>
      </div>

      <ul className="border-t border-white/10 pt-4 space-y-2.5 flex-1">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-xs text-gray-300 leading-relaxed">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={getPlanCtaHref(plan)}
        aria-label={`เลือกแพ็กเกจนี้: ${plan.name} ราคา ${formatTHB(plan.price)}`}
        className={`mt-8 w-full py-3 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
          plan.popular ? "bg-amber-400 hover:bg-amber-300 text-black shadow-glow" : "bg-white/10 hover:bg-white/20 text-white"
        }`}
      >
        เลือกแพ็กเกจนี้
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </Link>
    </li>
  );
}

export function PricingSection() {
  return (
    <section aria-labelledby={`${HOME_SECTION_IDS.pricing}-heading`} id={HOME_SECTION_IDS.pricing} className="scroll-mt-20 py-20 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id={`${HOME_SECTION_IDS.pricing}-heading`}
          eyebrow="แพ็กเกจและราคา"
          title="เลือกระยะเวลา ที่เหมาะกับคุณ"
          description="ชำระครั้งเดียวต่อรอบผ่าน PromptPay ไม่มีการตัดเงินอัตโนมัติ"
          align="center"
        />

        <div className="mt-8 mx-auto max-w-3xl rounded-2xl glass-panel-gold px-5 py-4 text-center">
          <p className="font-heading font-semibold text-amber-300">{PROMO_SETTINGS.promoTitle}</p>
          <p className="mt-1 text-xs sm:text-sm text-gray-300">{PROMO_SETTINGS.promoSubtitle}</p>
        </div>

        <ul className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-5">
          {SITE_PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </ul>

        <p className="mt-6 mx-auto max-w-3xl text-xs text-gray-400 text-center leading-relaxed">{RISK_DISCLAIMER}</p>

        <p className="mt-4 flex items-start justify-center gap-2 text-xs text-gray-400 text-center">
          <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            ก่อนชำระเงิน โปรดอ่าน{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-amber-400">
              ข้อกำหนดการใช้บริการ
            </Link>{" "}
            และ{" "}
            <Link href="/refund" className="underline underline-offset-2 hover:text-amber-400">
              นโยบายการคืนเงิน
            </Link>
          </span>
        </p>
      </div>
    </section>
  );
}
