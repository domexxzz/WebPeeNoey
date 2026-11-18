import Image from "next/image";
import { ArrowUpRight, Check, Download, Table2 } from "lucide-react";
import {
  TRADING_JOURNAL,
  TRADING_JOURNAL_COPY,
  TRADING_JOURNAL_IMAGE,
  type TradingJournalResource,
} from "@/config/member-resources";

/**
 * ไฟล์แจกสำหรับสมาชิก — แสดงเฉพาะคนที่มีสิทธิ์ใช้งานอยู่ (หน้า /account ตัดสินใจก่อนเรียกคอมโพเนนต์นี้)
 * ไม่ได้ตั้งไฟล์ไว้ = ไม่แสดงอะไรเลย ดีกว่าโชว์ปุ่มที่กดแล้วไปหน้าว่าง
 */
interface MemberResourcesProps {
  journal?: TradingJournalResource | null;
  /** true = แอดมินเปิดดูทั้งที่ไม่มีแพ็กเกจ — บอกให้ชัดว่าสมาชิกเห็นก็ต่อเมื่อมีสิทธิ์ใช้งานอยู่ */
  adminPreview?: boolean;
}

export function MemberResources({ journal = TRADING_JOURNAL, adminPreview = false }: MemberResourcesProps) {
  if (!journal) return null;

  return (
    <section aria-labelledby="member-resources-heading" className="border border-line bg-surface rounded-2xl overflow-hidden">
      {adminPreview && (
        <p className="border-b border-line bg-gold-muted px-5 sm:px-6 py-3 text-xs text-fg">
          คุณเห็นการ์ดนี้เพราะเป็นแอดมิน — สมาชิกจะเห็นก็ต่อเมื่อมีสิทธิ์ใช้งานอยู่เท่านั้น
        </p>
      )}
      <div className="flex items-start gap-3 border-b border-line px-5 sm:px-6 py-5">
        <span className="flex w-10 h-10 shrink-0 items-center justify-center border border-line text-gold-ink rounded-xl">
          <Table2 className="w-5 h-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="member-resources-heading" className="font-display text-lg font-bold tracking-tight text-fg">
            {TRADING_JOURNAL_COPY.title}
          </h2>
          <p className="mt-1 text-sm text-fg-muted leading-relaxed">{TRADING_JOURNAL_COPY.description}</p>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-5 sm:px-6 py-5 sm:flex-row sm:items-start">
        <Image
          src={TRADING_JOURNAL_IMAGE.src}
          width={TRADING_JOURNAL_IMAGE.width}
          height={TRADING_JOURNAL_IMAGE.height}
          sizes={TRADING_JOURNAL_IMAGE.sizes}
          alt={TRADING_JOURNAL_IMAGE.alt}
          className="w-full sm:w-[220px] shrink-0 border border-line rounded-xl"
        />
        <ul className="flex flex-col gap-2.5">
          {TRADING_JOURNAL_COPY.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2 text-sm text-fg-muted">
              <Check className="w-4 h-4 mt-0.5 shrink-0 text-gold-ink" aria-hidden="true" />
              {bullet}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3 border-t border-line px-5 sm:px-6 py-5 sm:flex-row sm:items-center">
        <a
          href={journal.copyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-fg transition-colors hover:bg-gold-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-ink"
        >
          {TRADING_JOURNAL_COPY.copyLabel}
          <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
        </a>
        <a
          href={journal.xlsxUrl}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-semibold text-fg transition-colors hover:border-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-ink"
        >
          <Download className="w-4 h-4 text-gold-ink" aria-hidden="true" />
          {TRADING_JOURNAL_COPY.xlsxLabel}
        </a>
        <a
          href={journal.previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-gold-ink hover:underline sm:ml-1"
        >
          {TRADING_JOURNAL_COPY.previewLabel}
        </a>
      </div>

      <p className="border-t border-line px-5 sm:px-6 py-4 text-xs text-fg-subtle leading-relaxed">{TRADING_JOURNAL_COPY.note}</p>
    </section>
  );
}
