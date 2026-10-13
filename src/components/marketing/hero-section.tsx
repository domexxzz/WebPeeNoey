import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight, BellRing, Check, Send } from "lucide-react";
import { HERO_CONTENT, HOME_SECTION_IDS } from "@/config/marketing";
import { loadDelayStyle as loadDelay } from "@/lib/motion";
import { LiveChart } from "./live-chart";
import { Phrases } from "./phrases";

/** แถบชื่อขนาดใหญ่เลื่อนวนแนวนอน (ตกแต่ง) — ชี้แล้วหยุด, คำโปร่งเติมสีเขียว, หยุดนิ่งเมื่อผู้ใช้ตั้งค่าลดการเคลื่อนไหว */
function HeroMarquee() {
  const copies = [0, 1];
  return (
    <div aria-hidden="true" data-loop="" className="mx-load overflow-hidden border-b border-line py-5 sm:py-7 select-none" style={loadDelay(900)}>
      <div className="flex w-max animate-marquee motion-reduce:animate-none hover:[animation-play-state:paused]">
        {copies.map((copy) => (
          <div key={copy} className="flex shrink-0 items-center gap-6 sm:gap-10 pr-6 sm:pr-10">
            {HERO_CONTENT.marquee.map((word, index) => (
              <Fragment key={`${copy}-${index}`}>
                <span
                  className={`font-display font-bold tracking-tight whitespace-nowrap leading-none text-6xl sm:text-8xl lg:text-[8.5rem] transition-colors duration-300 ${
                    index % 2 === 1
                      ? "text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.85)] hover:text-signal hover:[-webkit-text-stroke:1.5px_#6EEA6E]"
                      : "text-white hover:text-signal"
                  }`}
                >
                  {word}
                </span>
                <span className="inline-block w-4 h-4 sm:w-6 sm:h-6 shrink-0 rotate-45 rounded-[5px] bg-signal transition-transform duration-700 hover:rotate-[225deg]" />
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
    <section
      aria-labelledby="hero-heading"
      data-spotlight=""
      className="border-b border-line [--spot-size:520px] [--spot-color:rgba(110,234,110,0.07)]"
    >
      <div className="grid lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
        <div className="flex flex-col justify-between gap-12 px-4 sm:px-6 lg:px-10 py-12 sm:py-16 lg:py-20 lg:border-r lg:border-line">
          <div>
            <p className="mx-load inline-flex items-center gap-2 border border-line px-3 py-1.5 text-xs font-semibold tracking-wide text-signal rounded-full">
              <span aria-hidden="true" className="mx-ping w-1.5 h-1.5 bg-signal rounded-full" />
              {HERO_CONTENT.eyebrow}
            </p>

            <h1
              id="hero-heading"
              className="mx-load-words mt-7 font-display font-bold tracking-tight text-white text-[2.05rem] leading-[1.12] min-[400px]:text-[2.3rem] sm:text-[3.4rem] lg:text-[3rem] xl:text-[3.5rem] 2xl:text-[4.25rem]"
              style={loadDelay(120)}
            >
              <Phrases text={HERO_CONTENT.titleLead} animate />{" "}
              <span className="block mt-1 text-signal">
                <Phrases text={HERO_CONTENT.titleHighlight} animate startIndex={HERO_CONTENT.titleLead.split(" ").length} />
              </span>
            </h1>

            <p className="mx-load mt-7 max-w-xl text-base sm:text-lg text-gray-300 leading-relaxed" style={loadDelay(650)}>
              {HERO_CONTENT.subtitle}
            </p>
          </div>

          <ul className="grid gap-px bg-line border border-line sm:grid-cols-3 rounded-2xl overflow-hidden">
            {HERO_CONTENT.highlights.map((item, index) => (
              <li
                key={item}
                className="mx-load group flex items-start gap-2.5 bg-ink p-4 text-sm text-gray-200 leading-relaxed transition-colors hover:bg-ink-raised"
                style={loadDelay(820 + index * 110)}
              >
                <Check className="w-4 h-4 mt-0.5 shrink-0 text-signal transition-transform duration-500 group-hover:scale-125 group-hover:-rotate-12" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <figure data-loop="" className="relative isolate flex flex-col justify-center gap-4 bg-ink-raised px-4 sm:px-8 lg:px-12 py-12 sm:py-16 lg:py-20">
          <span aria-hidden="true" className="mx-grid" />
          <LiveChart
            decorations={
              <>
                {/* กล่องตกแต่งลอยรอบกราฟ (ไม่เอียงตามเมาส์แล้ว — กราฟเป็น iframe ที่รับเมาส์เอง) */}
                <span aria-hidden="true" className="pointer-events-none absolute -left-3 -top-4 sm:-left-6 sm:-top-6">
                  <span className="mx-float flex w-12 h-12 sm:w-16 sm:h-16 items-center justify-center rounded-xl border border-line bg-ink shadow-[0_16px_40px_-12px_rgba(110,234,110,0.45)]">
                    <BellRing className="mx-ring w-5 h-5 sm:w-6 sm:h-6 text-signal" />
                  </span>
                </span>
                <span aria-hidden="true" className="pointer-events-none absolute -right-3 -bottom-4 sm:-right-6 sm:-bottom-6">
                  <span className="mx-float-slow flex w-12 h-12 sm:w-16 sm:h-16 items-center justify-center rounded-xl bg-signal shadow-[0_16px_40px_-12px_rgba(110,234,110,0.6)]">
                    <Send className="mx-whoosh w-5 h-5 sm:w-6 sm:h-6 text-ink" />
                  </span>
                </span>
              </>
            }
          />
        </figure>
      </div>

      <HeroMarquee />

      <div className="px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
        <div className="mx-load flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center" style={loadDelay(1050)}>
          <Link
            href={`/#${HOME_SECTION_IDS.pricing}`}
            data-magnetic=""
            className="mx-shine mx-shine-auto group inline-flex items-center justify-center gap-2 rounded-xl bg-signal px-7 py-4 text-sm font-semibold text-ink shadow-[0_14px_36px_-14px_rgba(110,234,110,0.7)] hover:bg-signal-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            ดูแพ็กเกจและราคา
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
          </Link>
          <Link
            href={`/#${HOME_SECTION_IDS.howItWorks}`}
            className="inline-flex items-center justify-center rounded-xl border border-line px-7 py-4 text-sm font-medium text-gray-100 transition-colors hover:border-signal hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            ดูขั้นตอนการใช้งาน
          </Link>
          <p className="text-sm text-gray-400 sm:ml-3">สมัคร จ่าย แนบสลิป แล้วรับสิทธิ์ — ทำได้เองทั้งหมดผ่านหน้าเว็บ</p>
        </div>
      </div>
    </section>
  );
}
