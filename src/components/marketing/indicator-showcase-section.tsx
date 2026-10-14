import Image from "next/image";
import { Expand, Info } from "lucide-react";
import { INDICATOR_SHOWCASE } from "@/config/marketing";
import { staggerStyle } from "@/lib/motion";
import { SectionHeading } from "./section-heading";

/**
 * ภาพหน้าจอจริงของอินดิเคเตอร์บน TradingView + คำอธิบายสิ่งที่เห็นในภาพ
 * หมายเหตุใต้ภาพบอกชัดว่าสถิติในตารางเป็นผลย้อนหลังบนกราฟ ไม่ใช่ผลเทรดจริง (CLAUDE.md ข้อ 3)
 */
export function IndicatorShowcaseSection() {
  const { id, eyebrow, title, description, image, meta, legend, disclaimer } = INDICATOR_SHOWCASE;
  return (
    <section aria-labelledby={`${id}-heading`} id={id} className="scroll-mt-20 border-b border-line">
      <div className="px-4 sm:px-6 lg:px-10 py-20 sm:py-28">
        <SectionHeading id={`${id}-heading`} eyebrow={eyebrow} title={title} description={description} />

        <figure data-reveal="zoom" className="mt-12">
          <a
            href={image.src}
            target="_blank"
            rel="noopener"
            className="group relative block overflow-hidden rounded-2xl border border-line bg-surface-sunken shadow-[0_40px_100px_-40px_rgba(212,165,55,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-ink"
          >
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes={image.sizes}
              className="h-auto w-full transition-transform duration-700 ease-out group-hover:scale-[1.015]"
            />
            <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-page/85 px-3 py-1.5 text-xs font-medium text-fg backdrop-blur transition-colors group-hover:border-gold group-hover:text-gold-ink">
              <Expand className="w-3.5 h-3.5" aria-hidden="true" />
              ดูภาพขนาดเต็ม
            </span>
          </a>
          <figcaption className="mt-3 text-xs text-fg-subtle sm:pl-1">{meta}</figcaption>
        </figure>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {legend.map((item, index) => (
            <li key={item.title} data-reveal="up" style={staggerStyle(index, 100)} className="rounded-2xl border border-line bg-surface/80 p-5">
              <p className="flex items-center gap-2 font-display text-base font-bold text-fg">
                <span aria-hidden="true" className="flex w-6 h-6 shrink-0 items-center justify-center rounded-full bg-gold text-xs text-fg tabular-nums">
                  {index + 1}
                </span>
                {item.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-fg-subtle">{item.description}</p>
            </li>
          ))}
        </ul>

        <p data-reveal="up" className="mt-6 flex items-start gap-2.5 rounded-2xl border border-line px-5 py-4 text-xs sm:text-sm leading-relaxed text-fg-muted">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-gold-ink" aria-hidden="true" />
          <span>{disclaimer}</span>
        </p>
      </div>
    </section>
  );
}
