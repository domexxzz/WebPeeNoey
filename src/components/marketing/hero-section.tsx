import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { HERO_CONTENT, HOME_SECTION_IDS, IMAGE_SLOTS } from "@/config/marketing";
import { ImageSlot } from "./image-slot";
import { Phrases } from "./phrases";

export function HeroSection() {
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top_left,black_30%,transparent_75%)]"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 sm:pt-20 lg:pt-24 grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <div className="space-y-7">
          <p className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            {HERO_CONTENT.eyebrow}
          </p>

          <h1 id="hero-heading" className="font-heading text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-white leading-[1.15]">
            <Phrases text={HERO_CONTENT.titleLead} />{" "}
            <span className="block mt-2 bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
              <Phrases text={HERO_CONTENT.titleHighlight} />
            </span>
          </h1>

          <p className="text-base sm:text-lg text-gray-300 leading-relaxed max-w-xl">{HERO_CONTENT.subtitle}</p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/#${HOME_SECTION_IDS.pricing}`}
              className="px-7 py-3.5 rounded-xl font-semibold text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-glow transition-all flex items-center justify-center gap-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              ดูแพ็กเกจและราคา
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              href={`/#${HOME_SECTION_IDS.howItWorks}`}
              className="px-7 py-3.5 rounded-xl font-medium text-gray-200 glass-panel hover:bg-white/10 hover:border-white/20 transition-colors text-sm text-center"
            >
              ดูขั้นตอนการใช้งาน
            </Link>
          </div>

          <ul className="grid gap-2.5 pt-2">
            {HERO_CONTENT.highlights.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-gray-300">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div aria-hidden="true" className="absolute -inset-6 rounded-[2rem] bg-amber-500/10 blur-3xl" />
          <div className="relative rounded-3xl glass-panel-gold p-2.5 shadow-2xl shadow-black/40 lg:rotate-[0.6deg]">
            <div className="flex items-center gap-1.5 px-3 pt-1.5 pb-3" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
            </div>
            <ImageSlot spec={IMAGE_SLOTS.heroChart} alt="ตัวอย่างอินดิเคเตอร์บนกราฟ TradingView" priority />
          </div>
        </div>
      </div>
    </section>
  );
}
