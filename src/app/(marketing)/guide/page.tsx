import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";
import { HOME_SECTION_IDS, IMAGE_SLOTS } from "@/config/marketing";
import { GUIDE_SECTIONS, TROUBLESHOOTING } from "@/content/guide";
import { buildPageMetadata } from "@/lib/seo";
import { ImageSlot } from "@/components/marketing/image-slot";
import { PageHeader } from "@/components/marketing/page-header";

export const metadata: Metadata = buildPageMetadata({
  title: "คู่มือการใช้งาน",
  description:
    "คู่มือทีละขั้นตอน ตั้งแต่สมัครสมาชิก ชำระเงินผ่าน PromptPay แนบสลิป เปิดใช้อินดิเคเตอร์ Invite-only บน TradingView ไปจนถึงการต่ออายุ",
  path: "/guide",
});

const TROUBLESHOOTING_ID = "troubleshooting";

export default function GuidePage() {
  return (
    <>
      <PageHeader
        eyebrow="คู่มือการใช้งาน"
        title="ตั้งแต่สมัคร จนเริ่มใช้งานจริง"
        description="ทำตามทีละขั้นตอน หากติดปัญหาดูหัวข้อแก้ปัญหาที่พบบ่อยท้ายหน้า หรือติดต่อทีมงานได้ทันที"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 grid gap-12 lg:grid-cols-[240px_1fr]">
        <nav aria-label="สารบัญคู่มือ">
          <ol className="lg:sticky lg:top-24 grid gap-1 sm:grid-cols-2 lg:grid-cols-1 border border-line bg-ink p-3 text-sm rounded-2xl">
            {GUIDE_SECTIONS.map((section, index) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="flex gap-3 px-3 py-2 text-gray-400 hover:bg-white/5 hover:text-signal transition-colors">
                  <span className="font-display font-semibold text-signal">{String(index + 1).padStart(2, "0")}</span>
                  {section.title}
                </a>
              </li>
            ))}
            <li>
              <a href={`#${TROUBLESHOOTING_ID}`} className="flex gap-3 px-3 py-2 text-gray-400 hover:bg-white/5 hover:text-signal transition-colors">
                <span className="font-display font-semibold text-signal">?</span>
                แก้ปัญหาที่พบบ่อย
              </a>
            </li>
          </ol>
        </nav>

        <div className="max-w-3xl space-y-16">
          {GUIDE_SECTIONS.map((section, index) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="scroll-mt-24">
              <p className="font-display text-sm font-semibold text-signal">ขั้นตอนที่ {index + 1}</p>
              <h2 id={`${section.id}-heading`} className="mt-1 font-display text-2xl font-bold text-white">
                {section.title}
              </h2>
              <p className="mt-3 text-gray-300 leading-relaxed">{section.intro}</p>

              {section.steps && (
                <ol className="mt-6 space-y-3">
                  {section.steps.map((step, stepIndex) => (
                    <li key={step} className="flex gap-3 text-sm sm:text-base text-gray-300 leading-relaxed">
                      <span
                        aria-hidden="true"
                        className="mt-0.5 w-6 h-6 shrink-0 bg-white/5 border border-line text-xs flex items-center justify-center text-gray-400 rounded-full"
                      >
                        {stepIndex + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              )}

              {section.tips?.map((tip) => (
                <p key={tip} className="mt-5 flex items-start gap-2.5 border border-line bg-signal-muted px-4 py-3 text-sm text-gray-100 rounded-xl">
                  <Lightbulb className="w-4 h-4 mt-0.5 shrink-0 text-signal" aria-hidden="true" />
                  {tip}
                </p>
              ))}

              {section.imageAlt && (
                <div className="mt-6">
                  <ImageSlot spec={IMAGE_SLOTS.guideStep} alt={section.imageAlt} />
                </div>
              )}

              {section.links && (
                <div className="mt-5 flex flex-wrap gap-3">
                  {section.links.map((link) => (
                    <Link key={link.href} href={link.href} className="inline-flex items-center gap-1.5 text-sm font-medium text-signal hover:text-signal">
                      {link.label}
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}

          <section id={TROUBLESHOOTING_ID} aria-labelledby={`${TROUBLESHOOTING_ID}-heading`} className="scroll-mt-24">
            <h2 id={`${TROUBLESHOOTING_ID}-heading`} className="font-display text-2xl font-bold text-white">
              แก้ปัญหาที่พบบ่อย
            </h2>
            <dl className="mt-6 divide-y divide-white/10 border-y border-line">
              {TROUBLESHOOTING.map((item) => (
                <div key={item.problem} className="py-5">
                  <dt className="font-medium text-white">{item.problem}</dt>
                  <dd className="mt-2 text-sm text-gray-400 leading-relaxed">{item.solution}</dd>
                </div>
              ))}
            </dl>
            <Link
              href={`/#${HOME_SECTION_IDS.contact}`}
              className="mt-8 inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-ink bg-signal hover:bg-signal-hover rounded-xl"
            >
              ยังแก้ไม่ได้? ติดต่อทีมงาน
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}
