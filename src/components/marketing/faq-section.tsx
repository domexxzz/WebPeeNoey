import { Plus } from "lucide-react";
import { FAQ_ITEMS, HOME_SECTION_IDS } from "@/config/marketing";
import { buildFaqJsonLd } from "@/lib/seo";
import { staggerStyle } from "@/lib/motion";
import { JsonLd } from "./json-ld";
import { SectionHeading } from "./section-heading";

export function FaqSection() {
  return (
    <section aria-labelledby={`${HOME_SECTION_IDS.faq}-heading`} id={HOME_SECTION_IDS.faq} className="scroll-mt-20 border-b border-line">
      <JsonLd data={buildFaqJsonLd(FAQ_ITEMS)} />
      <div className="grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]">
        <div className="px-4 sm:px-6 lg:px-10 pt-20 pb-10 sm:pt-28 lg:pb-28 lg:border-r lg:border-line">
          <div className="lg:sticky lg:top-28">
            <SectionHeading
              id={`${HOME_SECTION_IDS.faq}-heading`}
              eyebrow="คำถามพบบ่อย"
              title="ข้อสงสัย ก่อนสมัครสมาชิก"
              description="หากไม่พบคำตอบที่ต้องการ ติดต่อทีมงานได้ตามช่องทางด้านล่าง"
            />
          </div>
        </div>

        <div className="space-y-3 px-4 sm:px-6 lg:px-10 pb-20 sm:pb-28 lg:py-20">
          {FAQ_ITEMS.map((item, index) => (
            <details
              key={item.question}
              data-reveal="up"
              style={staggerStyle(index, 70)}
              className="mx-faq group rounded-2xl border border-line bg-ink-raised/60 transition-colors hover:border-line-strong open:border-signal/50 open:bg-ink-raised"
            >
              <summary className="flex cursor-pointer list-none items-start gap-4 sm:gap-5 rounded-2xl px-5 sm:px-6 py-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="font-display text-sm font-semibold text-signal tabular-nums pt-1">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 font-display text-lg sm:text-xl font-bold tracking-tight text-white group-hover:text-signal">{item.question}</span>
                <span aria-hidden="true" className="mt-0.5 flex w-8 h-8 shrink-0 items-center justify-center rounded-full border border-line transition-colors group-hover:border-signal group-open:bg-signal group-open:border-signal">
                  <Plus className="mx-faq-icon w-4 h-4 text-white group-open:text-ink" />
                </span>
              </summary>
              <p className="mx-faq-answer pb-6 pl-[3.25rem] sm:pl-[4.25rem] pr-6 sm:pr-14 text-base text-gray-300 leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
