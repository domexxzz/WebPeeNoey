"use client";

import { useActionState, useTransition } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { BROKERS } from "@/config/broker-ib";
import { importBrokerReportsAction, type ReportImportRow, type ReportImportState } from "@/app/(admin)/admin/broker-claims/import/actions";
import type { ReportMatchVerdict } from "@/lib/broker-ib/report-review";
import { labelClass } from "./admin-ui";

const INITIAL_STATE: ReportImportState = { status: "idle" };

const VERDICT_LABELS: Record<ReportMatchVerdict, { text: string; ok: boolean }> = {
  QUALIFIES: { text: "ผ่าน — อนุมัติได้", ok: true },
  NOT_IN_REPORT: { text: "ไม่พบบัญชีในรายงาน", ok: false },
  EMAIL_MISMATCH: { text: "อีเมลไม่ตรงกับรายงาน", ok: false },
  DEPOSIT_UNKNOWN: { text: "รายงานไม่มียอดฝาก", ok: false },
  DEPOSIT_BELOW: { text: "ยอดฝากไม่ถึงขั้นต่ำ", ok: false },
  NO_MIN_DEPOSIT: { text: "คำขอไม่มียอดฝากขั้นต่ำ", ok: false },
  NO_REPORT_FOR_BROKER: { text: "ยังไม่ได้อัปโหลดรายงานของโบรกเกอร์นี้", ok: false },
};

const formatUsd = (value: number | null) => (value === null ? "—" : `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`);

function Outcome({ row }: { row: ReportImportRow }) {
  if (row.outcome === "APPROVED") return <span className="font-semibold text-gold-ink">อนุมัติแล้ว</span>;
  if (row.outcome === "FAILED") return <span className="text-red-700">อนุมัติไม่ได้: {row.outcomeNote}</span>;
  const label = VERDICT_LABELS[row.verdict];
  return <span className={label.ok ? "text-gold-ink" : "text-fg-muted"}>{label.text}</span>;
}

/**
 * อัปโหลดรายงาน .csv ที่ export จาก Partner Portal → ดูผลเทียบกับคำขอที่รอตรวจ → อนุมัติเฉพาะที่ผ่าน
 * ส่งด้วย onSubmit (ไม่ใช่ form action) เพื่อไม่ให้ React ล้างไฟล์ที่เลือกไว้หลังดูผล — กด "อนุมัติ" ได้ทันทีด้วยไฟล์ชุดเดิม
 * การอนุมัติจริงคำนวณใหม่จากไฟล์ที่ฝั่งเซิร์ฟเวอร์ (ไม่เชื่อผลที่แสดงบนหน้า)
 */
export function BrokerReportImport() {
  const [state, formAction] = useActionState(importBrokerReportsAction, INITIAL_STATE);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "approve") {
      const qualifying = state.status === "done" ? state.rows.filter((row) => !row.outcome && row.verdict === "QUALIFIES").length : 0;
      const question = `ผลตรวจล่าสุดผ่านเงื่อนไข ${qualifying} คำขอ — อนุมัติตอนนี้?\n(ระบบคำนวณใหม่จากไฟล์ที่เลือกอยู่ตอนกด ถ้าเปลี่ยนไฟล์ให้กดตรวจสอบก่อน)`;
      if (!window.confirm(question)) return;
    }
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4 border border-line bg-surface p-5 rounded-2xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="xm-files" className={labelClass}>
              รายงาน {BROKERS.XM.label} (.csv ไม่เกิน 2 ไฟล์ ไฟล์ละ 1MB — รายชื่อเทรดเดอร์ / ธุรกรรมเงินฝาก)
            </label>
            <input id="xm-files" name="xmFiles" type="file" accept=".csv,text/csv" multiple className="block w-full text-sm text-fg" />
          </div>
          <div>
            <label htmlFor="exness-files" className={labelClass}>
              รายงาน {BROKERS.EXNESS.label} (.csv ไม่เกิน 2 ไฟล์ ไฟล์ละ 1MB — Client accounts / Client transactions)
            </label>
            <input id="exness-files" name="exnessFiles" type="file" accept=".csv,text/csv" multiple className="block w-full text-sm text-fg" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="mode"
            value="preview"
            disabled={pending}
            className="inline-flex items-center gap-2 border border-line px-4 py-2.5 text-sm font-semibold text-fg hover:bg-fg/[0.05] disabled:opacity-60 rounded-xl"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            ตรวจสอบ (ยังไม่อนุมัติ)
          </button>
          <button
            type="submit"
            name="mode"
            value="approve"
            disabled={pending || state.status !== "done"}
            title={state.status !== "done" ? "กดตรวจสอบก่อน" : undefined}
            className="inline-flex items-center gap-2 bg-gold px-4 py-2.5 text-sm font-semibold text-fg hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            อนุมัติคำขอที่ผ่านเงื่อนไข
          </button>
        </div>
      </form>

      {state.status === "error" && (
        <p role="alert" className="flex items-start gap-2 text-sm text-red-700">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}

      {state.status === "done" && (
        <section aria-live="polite" className="space-y-4">
          <p role="status" className="flex items-start gap-2 text-sm text-gold-ink">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            {state.message}
          </p>
          <ul className="space-y-1 text-xs text-fg-muted">
            {state.files.map((file) => (
              <li key={`${file.broker}-${file.name}`}>
                <span className="font-medium text-fg">{BROKERS[file.broker].label}: {file.name}</span>{" "}
                {file.error
                  ? <span className="text-red-700">— {file.error}</span>
                  : `— ${file.rows} แถว, ${file.accounts} บัญชี | เลขบัญชี: "${file.columns?.account}" | อีเมล: ${file.columns?.email ? `"${file.columns.email}"` : "ไม่มี"} | ยอดฝาก: ${file.columns?.deposit ? `"${file.columns.deposit}"` : "ไม่มี"}`}
              </li>
            ))}
          </ul>
          <div className="overflow-x-auto border border-line bg-surface rounded-2xl">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs text-fg-subtle">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-medium">คำขอ</th>
                  <th className="px-4 py-3 font-medium">สมาชิก</th>
                  <th className="px-4 py-3 font-medium">บัญชี</th>
                  <th className="px-4 py-3 font-medium">ยอดฝาก / ขั้นต่ำ</th>
                  <th className="px-4 py-3 font-medium">ผล</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {state.rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-fg-subtle">ไม่มีคำขอที่รอตรวจ</td>
                  </tr>
                )}
                {state.rows.map((row) => (
                  <tr key={row.orderId}>
                    <td className="px-4 py-3">
                      <a href={`/admin/broker-claims/${row.orderId}`} className="font-mono text-gold-ink hover:underline">{row.orderNumber}</a>
                    </td>
                    <td className="px-4 py-3 text-fg">{row.email}</td>
                    <td className="px-4 py-3 font-mono text-fg">{BROKERS[row.broker].label} {row.accountMasked}</td>
                    <td className="px-4 py-3 tabular-nums text-fg-muted">
                      {formatUsd(row.depositUsd)} / {formatUsd(row.minDepositUsd)}
                      {row.verdict === "QUALIFIES" && !row.emailChecked && <div className="text-xs">ไม่ได้เทียบอีเมล (รายงานไม่มี)</div>}
                    </td>
                    <td className="px-4 py-3"><Outcome row={row} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
