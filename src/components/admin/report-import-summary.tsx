import Link from "next/link";
import { ArrowRight, FileUp } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { LatestReportImport } from "@/lib/broker-ib/report-review";

const MAX_ORDERS_SHOWN = 10;

/** สรุปการนำเข้ารายงานโบรกเกอร์ครั้งล่าสุด (อนุมัติสิทธิ์ IB อัตโนมัติ) — ใช้ในภาพรวมระบบและหน้านำเข้า */
export function ReportImportSummary({ latest, pendingClaims }: { latest: LatestReportImport | null; pendingClaims: number }) {
  return (
    <section aria-labelledby="report-import-summary" className="border border-line bg-surface p-6 rounded-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="report-import-summary" className="flex items-center gap-2 font-display text-lg font-bold text-fg">
            <FileUp className="w-5 h-5 text-gold-ink" aria-hidden="true" />
            รายงานโบรกเกอร์ (อนุมัติอัตโนมัติ)
          </h2>
          <p className="mt-1 text-sm text-fg-subtle">
            คำขอสิทธิ์ IB รอตรวจตอนนี้ <strong className="text-fg">{pendingClaims}</strong> รายการ
            {latest ? <> — นำเข้าล่าสุด {formatDateTime(latest.at)}{latest.actorEmail ? ` โดย ${latest.actorEmail}` : ""}</> : null}
          </p>
        </div>
        <Link
          href="/admin/broker-claims/import"
          className="inline-flex items-center gap-2 bg-gold px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-gold-hover"
        >
          นำเข้ารายงาน <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>

      {latest ? (
        <>
          <dl className="mt-5 grid grid-cols-3 gap-px border border-line bg-line text-center rounded-xl overflow-hidden">
            {[
              { label: "อนุมัติอัตโนมัติ", value: latest.approved, tone: "text-gold-ink" },
              { label: "รอตรวจเอง", value: latest.skipped, tone: "text-fg" },
              { label: "อนุมัติไม่ได้", value: latest.failed, tone: latest.failed > 0 ? "text-red-700" : "text-fg" },
            ].map((item) => (
              <div key={item.label} className="bg-surface p-3">
                <dt className="text-xs text-fg-subtle">{item.label}</dt>
                <dd className={`font-display text-2xl font-bold tabular-nums ${item.tone}`}>{item.value}</dd>
              </div>
            ))}
          </dl>
          {latest.approvedOrders.length > 0 && (
            <p className="mt-3 text-xs text-fg-muted">
              คำขอที่อนุมัติ: <span className="font-mono">{latest.approvedOrders.slice(0, MAX_ORDERS_SHOWN).join(", ")}</span>
              {latest.approvedOrders.length > MAX_ORDERS_SHOWN && ` และอีก ${latest.approvedOrders.length - MAX_ORDERS_SHOWN} รายการ`}
              {" — อย่าลืมเปิดสิทธิ์ TradingView / Discord / Telegram"}
            </p>
          )}
          {latest.files.length > 0 && <p className="mt-1 text-xs text-fg-subtle">ไฟล์: {latest.files.join(", ")}</p>}
        </>
      ) : (
        <p className="mt-4 text-sm text-fg-muted">ยังไม่เคยนำเข้ารายงาน — export รายงานจาก Partner Portal ของ XM / Exness เป็น .csv แล้วอัปโหลดเพื่ออนุมัติคำขอที่ผ่านเงื่อนไขทีเดียว</p>
      )}
    </section>
  );
}
