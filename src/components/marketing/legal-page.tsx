import { AlertTriangle } from "lucide-react";
import { formatThaiDate, legalConfig } from "@/config/legal";
import type { LegalDocument } from "@/content/legal";

export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <article className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold text-signal">นโยบายและข้อกำหนด</p>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl font-bold text-white">{document.title}</h1>
        <p className="mt-3 text-sm text-gray-400">
          มีผลบังคับใช้ตั้งแต่วันที่{" "}
          <time dateTime={legalConfig.effectiveDate}>{formatThaiDate(legalConfig.effectiveDate)}</time>
        </p>
      </header>

      {legalConfig.isDraft && (
        <div role="note" className="mt-8 max-w-3xl flex items-start gap-3 border border-signal bg-signal-muted px-5 py-4 text-sm text-gray-100 rounded-xl">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <p>ฉบับร่าง — เอกสารนี้อยู่ระหว่างการตรวจทานโดยผู้ให้บริการและที่ปรึกษากฎหมาย เนื้อหาอาจมีการแก้ไขก่อนเปิดให้บริการจริง</p>
        </div>
      )}

      <div className="mt-12 grid gap-12 lg:grid-cols-[220px_1fr]">
        <nav aria-label="สารบัญ" className="hidden lg:block">
          <ol className="sticky top-24 space-y-2 border-l border-line pl-4 text-sm">
            {document.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-gray-400 hover:text-signal transition-colors">
                  {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="max-w-3xl space-y-10">
          {document.sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="scroll-mt-24">
              <h2 id={`${section.id}-heading`} className="font-display text-xl font-semibold text-white">
                {section.heading}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-sm sm:text-base text-gray-300 leading-relaxed">
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-3 space-y-2 list-disc pl-5 marker:text-signal">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="text-sm sm:text-base text-gray-300 leading-relaxed">
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
