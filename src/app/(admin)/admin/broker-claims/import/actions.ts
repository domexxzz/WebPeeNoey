"use server";

import type { Broker } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendBrokerClaimApprovedEmail } from "@/lib/email";
import { sendAdminTelegram } from "@/lib/notify/telegram";
import { requireAdmin } from "@/lib/admin/run-admin-action";
import { adminErrorMessage, type AdminErrorCode } from "@/lib/admin/messages";
import { extractReportEvidence, mergeReportEvidence, parseCsv } from "@/lib/broker-ib/report-import";
import { approveQualifyingClaims, previewReportMatches, type EvidenceByBroker, type ReportMatchRow } from "@/lib/broker-ib/report-review";

/** นำเข้ารายงานจาก Partner Portal → ดูผลก่อน (preview) → อนุมัติเฉพาะที่ผ่าน (approve) — ไฟล์ไม่ถูกเก็บ */

// รวมไม่เกิน 4MB ต่อการส่ง — ต่ำกว่า serverActions.bodySizeLimit (5MB) จึงได้ข้อความแจ้งเตือนภาษาไทยแทน error ของ Next.js
const MAX_FILES_PER_BROKER = 2;
const MAX_FILE_BYTES = 1024 * 1024;
const FILE_FIELDS: Record<Broker, string> = { XM: "xmFiles", EXNESS: "exnessFiles" };

export interface ReportFileSummary {
  broker: Broker;
  name: string;
  rows: number;
  accounts: number;
  columns: { account: string; email: string | null; deposit: string | null } | null;
  error: string | null;
}

export type ReportImportRow = ReportMatchRow & { outcome?: "APPROVED" | "FAILED"; outcomeNote?: string };

export type ReportImportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; mode: "preview" | "approve"; message: string; files: ReportFileSummary[]; rows: ReportImportRow[] };

const FILE_ERRORS = {
  TOO_LARGE: "ไฟล์ใหญ่เกิน 1MB — กรองช่วงวันที่ในพอร์ทัลให้แคบลงแล้ว export ใหม่",
  NOT_CSV: "ต้องเป็นไฟล์ .csv (ใน Excel: Save As → CSV UTF-8)",
  EMPTY: "ไฟล์ว่าง",
  NO_ACCOUNT_COLUMN: "ไม่พบคอลัมน์เลขบัญชีเทรด (เช่น MT4/MT5 ID, Login, Client account)",
} as const;

/** UTF-16 (Excel "Unicode Text") หรือ UTF-8 */
function decode(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  return new TextDecoder("utf-8").decode(bytes);
}

async function readReports(formData: FormData): Promise<{ files: ReportFileSummary[]; evidence: EvidenceByBroker } | { error: string }> {
  const files: ReportFileSummary[] = [];
  const evidence: EvidenceByBroker = {};
  for (const broker of Object.keys(FILE_FIELDS) as Broker[]) {
    const uploads = formData.getAll(FILE_FIELDS[broker]).filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (uploads.length > MAX_FILES_PER_BROKER) return { error: `อัปโหลดได้ไม่เกิน ${MAX_FILES_PER_BROKER} ไฟล์ต่อโบรกเกอร์` };
    const parsed = [];
    for (const file of uploads) {
      const name = file.name.slice(0, 120);
      const fail = (code: keyof typeof FILE_ERRORS) => files.push({ broker, name, rows: 0, accounts: 0, columns: null, error: FILE_ERRORS[code] });
      if (file.size > MAX_FILE_BYTES) {
        fail("TOO_LARGE");
        continue;
      }
      if (!/\.(csv|txt)$/i.test(file.name)) {
        fail("NOT_CSV");
        continue;
      }
      const result = extractReportEvidence(parseCsv(decode(new Uint8Array(await file.arrayBuffer()))));
      if (!result.ok) {
        fail(result.code);
        continue;
      }
      parsed.push(result);
      files.push({ broker, name, rows: result.rows, accounts: result.accounts.size, columns: result.columns, error: null });
    }
    if (parsed.length > 0) evidence[broker] = mergeReportEvidence(parsed);
  }
  if (files.length === 0) return { error: "ยังไม่ได้เลือกไฟล์รายงาน" };
  return { files, evidence };
}

export async function importBrokerReportsAction(_previous: ReportImportState, formData: FormData): Promise<ReportImportState> {
  const actor = await requireAdmin();
  if (!actor) return { status: "error", message: adminErrorMessage("FORBIDDEN") };
  const mode = formData.get("mode") === "approve" ? "approve" : "preview";
  try {
    const read = await readReports(formData);
    if ("error" in read) return { status: "error", message: read.error };
    const { files, evidence } = read;

    if (mode === "preview") {
      const rows = await previewReportMatches(prisma, evidence);
      const qualifying = rows.filter((row) => row.verdict === "QUALIFIES").length;
      return { status: "done", mode, message: `ผ่านเงื่อนไข ${qualifying} จาก ${rows.length} คำขอที่รอตรวจ — ยังไม่ได้อนุมัติ`, files, rows };
    }

    const sourceFiles = files.filter((file) => !file.error).map((file) => `${file.broker}:${file.name}`);
    const result = await approveQualifyingClaims(prisma, { actor, evidenceByBroker: evidence, sourceFiles });
    let emailFailures = 0;
    for (const row of result.approved) {
      const sent = await sendBrokerClaimApprovedEmail(row.email, { orderNumber: row.orderNumber, periodEnd: row.periodEnd, isRenewal: row.isRenewal });
      if (!sent) {
        emailFailures++;
        console.error("[admin] ส่งอีเมลอนุมัติสิทธิ์ผ่าน IB (จากรายงาน) ไม่สำเร็จ", { orderNumber: row.orderNumber });
      }
    }
    if (result.approved.length > 0 || result.failed.length > 0) {
      await sendAdminTelegram(
        `📥 นำเข้ารายงานโบรกเกอร์: อนุมัติ ${result.approved.length} คำขอ${result.failed.length ? `, อนุมัติไม่ได้ ${result.failed.length}` : ""}, รอตรวจเอง ${result.skipped.length}
แอดมิน: ${actor.id}${emailFailures ? `\n⚠️ ส่งอีเมลอนุมัติไม่สำเร็จ ${emailFailures} ราย — แจ้งลูกค้าเอง` : ""}${result.approved.length ? "\nอย่าลืมเปิดสิทธิ์ TradingView / Discord / Telegram ให้คำขอที่อนุมัติ" : ""}`,
      );
    }
    revalidatePath("/admin");
    revalidatePath("/admin/broker-claims");

    const rows: ReportImportRow[] = [
      ...result.approved.map((row) => ({ ...row, outcome: "APPROVED" as const })),
      ...result.failed.map((row) => ({ ...row, outcome: "FAILED" as const, outcomeNote: adminErrorMessage(row.code as AdminErrorCode) })),
      ...result.skipped,
    ];
    const message = `อนุมัติแล้ว ${result.approved.length} คำขอ${result.failed.length ? ` — อนุมัติไม่ได้ ${result.failed.length}` : ""} — รอตรวจเอง ${result.skipped.length}${emailFailures ? ` (ส่งอีเมลไม่สำเร็จ ${emailFailures} ราย — แจ้งลูกค้าเอง)` : ""}`;
    return { status: "done", mode, message, files, rows };
  } catch (error) {
    console.error("[admin] importBrokerReports failed", { actorId: actor.id, error });
    await sendAdminTelegram(`⚠️ หลังบ้าน: นำเข้ารายงานโบรกเกอร์ล้มเหลว (UNEXPECTED)\nแอดมิน: ${actor.id}`);
    return { status: "error", message: adminErrorMessage("UNEXPECTED") };
  }
}
