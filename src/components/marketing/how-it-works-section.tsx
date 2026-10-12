import { HOME_SECTION_IDS, HOW_IT_WORKS } from "@/config/marketing";
import { staggerStyle } from "@/lib/motion";
import { SectionHeading } from "./section-heading";

/**
 * การ์ดซ้อนกันบนพื้นเขียว — ใบสุดท้ายตัดเฉียงให้ดูมีจังหวะ (เฉพาะจอ md ขึ้นไป)
 * เลื่อนมาถึง: การ์ดสไลด์เข้าทีละใบ ตัวเลขเลื่อนขึ้นจากใต้เส้น และเส้นด้านซ้ายเติมตามการเลื่อนหน้า
 * overflow-x-clip: การ์ดที่ยังไม่เผยเลื่อนมาจากขวาจะไม่ล้นจอจนเลื่อนแนวนอนได้ (clip ไม่ทำให้หัวข้อ sticky เสีย ต่างจาก hidden)
 */
const CARD_OFFSETS = ["md:ml-0", "md:ml-10", "md:ml-20", "md:ml-6"];

export function HowItWorksSection() {
  const lastIndex = HOW_IT_WORKS.length - 1;
  return (
    <section
      aria-labelledby={`${HOME_SECTION_IDS.howItWorks}-heading`}
      id={HOME_SECTION_IDS.howItWorks}
      className="scroll-mt-20 overflow-x-clip bg-signal text-ink"
    >
      <div className="grid gap-12 px-4 sm:px-6 lg:px-10 py-20 sm:py-28 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            id={`${HOME_SECTION_IDS.howItWorks}-heading`}
            eyebrow="ขั้นตอนการเข้าใช้งาน"
            title="เริ่มใช้งานได้ใน 4 ขั้นตอน"
            description="ทุกขั้นตอนทำผ่านหน้าเว็บ ไม่ต้องทักแชตเพื่อสั่งซื้อ และติดตามสถานะคำสั่งซื้อได้จากแดชบอร์ดสมาชิก"
            tone="signal"
          />
        </div>

        <ol className="relative space-y-3">
          <span aria-hidden="true" className="absolute -left-6 top-0 bottom-0 hidden w-[3px] bg-ink/15 md:block">
            <span className="hiw-rail-fill block h-full w-full bg-ink" />
          </span>
          {HOW_IT_WORKS.map((item, index) => (
            <li
              key={item.step}
              data-reveal="right"
              style={staggerStyle(index, 130)}
              className={`${CARD_OFFSETS[index % CARD_OFFSETS.length]} ${index === lastIndex ? "md:[clip-path:polygon(0_0,100%_0,97%_100%,3%_100%)]" : ""}`}
            >
              <div
                className={`group bg-ink text-white px-6 sm:px-8 py-7 sm:py-8 transition-[transform,box-shadow] duration-500 ease-out hover:translate-x-2 hover:shadow-[-8px_8px_0_0_rgba(17,19,18,0.35)] ${
                  index === lastIndex ? "md:px-12" : ""
                }`}
              >
              <div className="flex items-start gap-5 sm:gap-8">
                <span aria-hidden="true" className="mx-digit-mask font-display text-4xl sm:text-5xl font-bold leading-none text-signal tabular-nums">
                  <span className="mx-digit">{String(item.step).padStart(2, "0")}</span>
                </span>
                <div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight">
                    <span className="sr-only">ขั้นตอนที่ {item.step}: </span>
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm sm:text-base text-gray-300 leading-relaxed">{item.description}</p>
                </div>
              </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
