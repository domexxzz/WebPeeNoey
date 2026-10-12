import Link from "next/link";
import { ArrowRight, BarChart3, LifeBuoy, Lock, PlayCircle, Send, Users, type LucideIcon } from "lucide-react";
import { FEATURES, HOME_SECTION_IDS, type FeatureItem } from "@/config/marketing";
import { staggerStyle } from "@/lib/motion";
import { FeatureArt } from "./feature-art";
import { SectionHeading } from "./section-heading";

export const FEATURE_ICONS: Record<FeatureItem["icon"], LucideIcon> = {
  chart: BarChart3,
  send: Send,
  users: Users,
  video: PlayCircle,
  lifebuoy: LifeBuoy,
  lock: Lock,
};

/**
 * 3 ฟีเจอร์หลักแสดงเป็นแถวใหญ่พร้อมภาพประกอบเอียง ส่วนที่เหลือเป็นกล่องเรียงแถว
 * เลื่อนมาถึง: ภาพหมุนเข้าที่จากมุมเอียงสวนทาง (ART_FROM) แล้วชิ้นในภาพเด้งทีละชิ้น — ชี้แล้วภาพตั้งตรงพร้อมเงาเขียว
 */
const LEAD_COUNT = 3;
const TILTS = ["-rotate-2", "rotate-2", "-rotate-1"];
const ART_FROM = ["[--art-from:9deg]", "[--art-from:-9deg]", "[--art-from:7deg]"];

export function FeaturesSection() {
  const lead = FEATURES.slice(0, LEAD_COUNT);
  const rest = FEATURES.slice(LEAD_COUNT);

  return (
    <section aria-labelledby={`${HOME_SECTION_IDS.features}-heading`} id={HOME_SECTION_IDS.features} className="scroll-mt-20 border-b border-line">
      <div className="px-4 sm:px-6 lg:px-10 pt-20 sm:pt-28 pb-12">
        <SectionHeading
          id={`${HOME_SECTION_IDS.features}-heading`}
          eyebrow="สิ่งที่คุณได้รับ"
          title="ครบทั้งเครื่องมือ การแจ้งเตือน และคอมมูนิตี้"
        />
        <div data-reveal="up" style={staggerStyle(4, 90)} className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:pl-[18%]">
          <p className="max-w-2xl text-base sm:text-xl text-gray-200 leading-relaxed">
            ทุกแพ็กเกจได้รับสิทธิ์หลักเหมือนกัน แพ็กเกจระยะยาวจะมีสิทธิประโยชน์เพิ่มเติมตามที่ระบุในตารางราคา
          </p>
          <Link
            href="/features"
            className="group inline-flex items-center gap-2 shrink-0 text-sm font-semibold text-signal hover:text-signal-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
          >
            ดูรายละเอียดฟีเจอร์ทั้งหมด
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <ul data-loop="" className="mx-4 sm:mx-6 lg:mx-10">
        {lead.map((feature, index) => {
          const Icon = FEATURE_ICONS[feature.icon];
          return (
            <li key={feature.id} data-reveal="art" className="group grid gap-10 border-t border-line py-12 sm:py-16 md:grid-cols-2 md:items-center lg:gap-16">
              <div className={`mx-art relative mx-4 sm:mx-10 lg:mx-16 ${ART_FROM[index % ART_FROM.length]}`}>
                <div
                  className={`border border-line bg-ink-raised transition-[transform,box-shadow] duration-700 ease-out group-hover:rotate-0 group-hover:-translate-y-1 group-hover:shadow-[10px_10px_0_0_#6EEA6E] ${TILTS[index % TILTS.length]}`}
                >
                  <FeatureArt featureId={feature.id} />
                </div>
                <span className="absolute -left-4 -top-5 sm:-left-8 sm:-top-6 flex w-14 h-14 items-center justify-center border border-line bg-ink transition-[transform,background-color] duration-500 group-hover:-rotate-12 group-hover:bg-signal">
                  <Icon className="w-6 h-6 text-signal transition-colors group-hover:text-ink" aria-hidden="true" />
                </span>
              </div>
              <div className="max-w-md">
                <p aria-hidden="true" className="font-display text-sm font-semibold text-signal">
                  <span className="mx-digit-mask">
                    <span className="mx-digit">{String(index + 1).padStart(2, "0")}</span>
                  </span>
                </p>
                <h3 className="mt-3 font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">{feature.title}</h3>
                <p className="mt-4 text-base text-gray-300 leading-relaxed">{feature.description}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <ul className="grid gap-px bg-line border-t border-line sm:grid-cols-3">
        {rest.map((feature, index) => {
          const Icon = FEATURE_ICONS[feature.icon];
          return (
            <li key={feature.id} data-spotlight="" className="group bg-ink transition-colors hover:bg-ink-raised">
              <div data-reveal="up" style={staggerStyle(index, 120)} className="px-6 sm:px-8 py-10">
                <Icon className="w-6 h-6 text-signal transition-transform duration-500 ease-out group-hover:-translate-y-1 group-hover:scale-110" aria-hidden="true" />
                <h3 className="mt-5 font-display text-lg font-bold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-400 leading-relaxed">{feature.description}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
