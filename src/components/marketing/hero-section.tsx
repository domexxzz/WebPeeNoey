import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight, BellRing, Check, Send } from "lucide-react";
import { HERO_CONTENT, HOME_SECTION_IDS } from "@/config/marketing";
import { HeroChart } from "./hero-chart";
import { Phrases } from "./phrases";

/** แถบชื่อขนาดใหญ่เลื่อนวนแนวนอน (ตกแต่ง) — หยุดนิ่งเมื่อผู้ใช้ตั้งค่าลดการเคลื่อนไหว */
function HeroMarquee() {
  const copies = [0, 1];
  return (
    <div aria-hidden="true" className="overflow-hidden border-b border-line py-5 sm:py-7 select-none">
      <div className="flex w-max animate-marquee motion-reduce:animate-none">
        {copies.map((copy) => (
          <div key={copy} className="flex shrink-0 items-center gap-6 sm:gap-10 pr-6 sm:pr-10">
            {HERO_CONTENT.marquee.map((word, index) => (
              <Fragment key={`${copy}-${word}`}>
                <span
                  className={`font-display font-bold tracking-tight whitespace-nowrap leading-none text-6xl sm:text-8xl lg:text-[8.5rem] ${
                    index % 2 === 1 ? "text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.85)]" : "text-white"
                  }`}
                >
                  {word}
                </span>
                <span className="inline-block w-4 h-4 sm:w-6 sm:h-6 shrink-0 rotate-45 bg-signal" />
              </Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section aria-labelledby="hero-heading" className="border-b border-line">
      <div className="grid lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
        <div className="flex flex-col justify-between gap-12 px-4 sm:px-6 lg:px-10 py-12 sm:py-16 lg:py-20 lg:border-r lg:border-line">
          <div>
            <p className="inline-flex items-center gap-2 border border-line px-3 py-1.5 text-xs font-semibold tracking-wide text-signal">
              <span aria-hidden="true" className="w-1.5 h-1.5 bg-signal" />
              {HERO_CONTENT.eyebrow}
            </p>

            <h1
              id="hero-heading"
              className="mt-7 font-display font-bold tracking-tight text-white text-[2.05rem] leading-[1.12] min-[400px]:text-[2.3rem] sm:text-[3.4rem] lg:text-[3rem] xl:text-[3.5rem] 2xl:text-[4.25rem]"
            >
              <Phrases text={HERO_CONTENT.titleLead} />{" "}
              <span className="block mt-1 text-signal">
                <Phrases text={HERO_CONTENT.titleHighlight} />
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-base sm:text-lg text-gray-300 leading-relaxed">{HERO_CONTENT.subtitle}</p>
          </div>

          <ul className="grid gap-px bg-line border border-line sm:grid-cols-3">
            {HERO_CONTENT.highlights.map((item) => (
              <li key={item} className="flex items-start gap-2.5 bg-ink p-4 text-sm text-gray-200 leading-relaxed">
                <Check className="w-4 h-4 mt-0.5 shrink-0 text-signal" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <figure className="relative flex flex-col justify-center gap-4 bg-ink-raised px-4 sm:px-8 lg:px-12 py-12 sm:py-16 lg:py-20">
          <div className="relative">
            <HeroChart className="w-full h-auto" />
            <span aria-hidden="true" className="absolute -left-3 -top-4 sm:-left-6 sm:-top-6 flex w-12 h-12 sm:w-16 sm:h-16 items-center justify-center border border-line bg-ink">
              <BellRing className="w-5 h-5 sm:w-6 sm:h-6 text-signal" />
            </span>
            <span aria-hidden="true" className="absolute -right-3 -bottom-4 sm:-right-6 sm:-bottom-6 flex w-12 h-12 sm:w-16 sm:h-16 items-center justify-center bg-signal">
              <Send className="w-5 h-5 sm:w-6 sm:h-6 text-ink" />
            </span>
          </div>
          <figcaption className="text-xs text-gray-400 sm:pl-2">{HERO_CONTENT.visualCaption}</figcaption>
        </figure>
      </div>

      <HeroMarquee />

      <div className="px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
        <div className="flex flex-col md:flex-row md:items-stretch border border-line md:w-fit">
          <p className="flex items-center px-5 py-4 text-sm sm:text-base text-gray-100 md:border-r md:border-line">
            สมัคร จ่าย แนบสลิป แล้วรับสิทธิ์ — ทำได้เองทั้งหมดผ่านหน้าเว็บ
          </p>
          <Link
            href={`/#${HOME_SECTION_IDS.pricing}`}
            className="flex items-center justify-center gap-2 bg-signal px-7 py-4 text-sm font-semibold text-ink transition-colors hover:bg-signal-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            ดูแพ็กเกจและราคา
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            href={`/#${HOME_SECTION_IDS.howItWorks}`}
            className="flex items-center justify-center px-7 py-4 text-sm font-medium text-gray-100 border-t border-line md:border-t-0 md:border-l transition-colors hover:bg-white/[0.04] hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal"
          >
            ดูขั้นตอนการใช้งาน
          </Link>
        </div>
      </div>
    </section>
  );
}
