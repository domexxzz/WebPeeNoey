import { ChevronDown } from "lucide-react";
import { FAQ_ITEMS, HOME_SECTION_IDS } from "@/config/marketing";
import { buildFaqJsonLd } from "@/lib/seo";
import { JsonLd } from "./json-ld";
import { SectionHeading } from "./section-heading";

export function FaqSection() {
  return (
    <section
      aria-labelledby={`${HOME_SECTION_IDS.faq}-heading`}
      id={HOME_SECTION_IDS.faq}
      className="scroll-mt-20 py-20 sm:py-24 border-t border-white/5 bg-[#0D121C]"
    >
      <JsonLd data={buildFaqJsonLd(FAQ_ITEMS)} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeading
          id={`${HOME_SECTION_IDS.faq}-heading`}
          eyebrow="คำถามพบบ่อย"
          title="ข้อสงสัย ก่อนสมัครสมาชิก"
          description="หากไม่พบคำตอบที่ต้องการ ติดต่อทีมงานได้ตามช่องทางด้านล่าง"
        />

        <div className="divide-y divide-white/10 border-y border-white/10">
          {FAQ_ITEMS.map((item) => (
            <details key={item.question} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-sm sm:text-base font-medium text-white hover:text-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 rounded [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDown className="w-5 h-5 shrink-0 text-gray-500 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="pb-5 pr-8 text-sm text-gray-400 leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
