import { HOME_SECTION_IDS, HOW_IT_WORKS } from "@/config/marketing";
import { SectionHeading } from "./section-heading";

export function HowItWorksSection() {
  return (
    <section
      aria-labelledby={`${HOME_SECTION_IDS.howItWorks}-heading`}
      id={HOME_SECTION_IDS.howItWorks}
      className="scroll-mt-20 py-20 sm:py-24 border-y border-white/5 bg-[#0D121C]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id={`${HOME_SECTION_IDS.howItWorks}-heading`}
          eyebrow="ขั้นตอนการเข้าใช้งาน"
          title="เริ่มใช้งานได้ใน 4 ขั้นตอน"
          description="ทุกขั้นตอนทำผ่านหน้าเว็บ ไม่ต้องทักแชตเพื่อสั่งซื้อ และติดตามสถานะคำสั่งซื้อได้จากแดชบอร์ดสมาชิก"
        />

        <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((item) => (
            <li key={item.step} className="relative pl-14 lg:pl-0 lg:pt-16">
              <span
                aria-hidden="true"
                className="absolute left-0 top-0 w-11 h-11 rounded-full border border-amber-500/40 bg-[#0B0F17] flex items-center justify-center font-heading font-bold text-amber-400"
              >
                {item.step}
              </span>
              <span aria-hidden="true" className="hidden lg:block absolute left-12 right-0 top-[22px] h-px bg-gradient-to-r from-amber-500/40 to-transparent" />
              <h3 className="font-heading text-lg font-semibold text-white">
                <span className="sr-only">ขั้นตอนที่ {item.step}: </span>
                {item.title}
              </h3>
              <p className="mt-2 text-sm text-gray-400 leading-relaxed">{item.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
