import Link from "next/link";
import { ArrowRight, BarChart3, LifeBuoy, Lock, PlayCircle, Send, Users, type LucideIcon } from "lucide-react";
import { FEATURES, HOME_SECTION_IDS, type FeatureItem } from "@/config/marketing";
import { ChartDecoration } from "./chart-decoration";
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
 * Bento layout: การ์ดแรกเป็นฟีเจอร์หลัก กิน 2×2 ช่องบนจอใหญ่ (3 คอลัมน์ × 3 แถวพอดี)
 * การ์ดสุดท้ายกินเต็มแถวบนจอ 2 คอลัมน์ เพื่อไม่ให้เหลือช่องว่าง
 */
const SPAN_CLASSES = ["sm:col-span-2 lg:row-span-2", "", "", "", "", "sm:col-span-2 lg:col-span-1"];

export function FeaturesSection() {
  return (
    <section aria-labelledby={`${HOME_SECTION_IDS.features}-heading`} id={HOME_SECTION_IDS.features} className="scroll-mt-20 py-20 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            id={`${HOME_SECTION_IDS.features}-heading`}
            eyebrow="สิ่งที่คุณได้รับ"
            title="ครบทั้งเครื่องมือ การแจ้งเตือน และคอมมูนิตี้"
            description="ทุกแพ็กเกจได้รับสิทธิ์หลักเหมือนกัน แพ็กเกจระยะยาวจะมีสิทธิประโยชน์เพิ่มเติมตามที่ระบุในตารางราคา"
          />
          <Link href="/features" className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 shrink-0">
            ดูรายละเอียดฟีเจอร์ทั้งหมด
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const Icon = FEATURE_ICONS[feature.icon];
            const isLead = index === 0;
            return (
              <li
                key={feature.id}
                className={`group relative rounded-2xl border p-6 transition-colors ${SPAN_CLASSES[index] ?? ""} ${
                  isLead
                    ? "glass-panel-gold border-amber-500/25 overflow-hidden lg:flex lg:flex-col lg:justify-end lg:p-8"
                    : "glass-panel border-white/10 hover:border-amber-500/30"
                }`}
              >
                {isLead && <ChartDecoration className="hidden lg:block w-full h-40 mb-auto" />}
                <span
                  className={`inline-flex items-center justify-center rounded-xl ${
                    isLead ? "w-14 h-14 bg-amber-500 text-black" : "w-11 h-11 bg-white/5 text-amber-400 group-hover:bg-amber-500/15"
                  }`}
                >
                  <Icon className={isLead ? "w-7 h-7" : "w-5 h-5"} aria-hidden="true" />
                </span>
                <h3 className={`mt-5 font-heading font-semibold text-white ${isLead ? "text-2xl" : "text-base"}`}>{feature.title}</h3>
                <p className={`mt-2 leading-relaxed text-gray-400 ${isLead ? "text-base max-w-md" : "text-sm"}`}>{feature.description}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
