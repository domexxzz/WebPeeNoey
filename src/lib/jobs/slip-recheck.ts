import { Prisma, type PrismaClient } from "@prisma/client";
import { sendAdminTelegram } from "@/lib/notify/telegram";
import type { SlipCheckResult } from "@/lib/payments/easyslip";
import { SLIP_CHECK_LABELS } from "@/lib/orders/slip-notification";
import { createSlipInspector, shouldAlertProviderProblem, slipCheckFields, type SlipInspector } from "@/lib/orders/slip-inspection";
import { JOB_NAMES, JobPartialFailure, runJob, type AdminAlert, type JobOutcome } from "./job-run";

/** รอบละ 10 นาที × 12 = ราว 2 ชั่วโมง — เกินนี้ถือว่าตรวจอัตโนมัติไม่ได้ ให้แอดมินตรวจด้วยตา */
export const SLIP_RECHECK_MAX_ATTEMPTS = 12;
/** จำกัดต่อรอบ ไม่ให้ชนเพดานอัตราของ EasySlip */
const BATCH_SIZE = 10;
/** งบเวลาต่อรอบ (แต่ละการเรียก EasySlip หมดเวลาที่ 10 วินาที) — ต้องจบก่อน curl ของ workflow (90 วินาที) ตัดสาย ที่เหลือไปรอบหน้า */
const RUN_BUDGET_MS = 45_000;

export type SlipRecheckSummary = {
  checked: number;
  verified: number;
  flagged: number;
  stillPending: number;
  gaveUp: number;
  duplicates: number;
  failed: number;
};

export type SlipRecheckOutcome = JobOutcome<SlipRecheckSummary> | { ok: true; skipped: true };

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** สลิปที่ยังรอคำตอบจากธนาคาร และยังเป็นสลิปปัจจุบันของออเดอร์ที่รอตรวจ */
async function findCandidates(db: PrismaClient) {
  const uploads = await db.slipUpload.findMany({
    where: { checkStatus: "PENDING", checkAttempts: { lt: SLIP_RECHECK_MAX_ATTEMPTS }, order: { status: "SLIP_SUBMITTED", kind: "PAID" } },
    orderBy: { checkedAt: "asc" },
    take: BATCH_SIZE,
    // ไม่ดึงไฟล์สลิป (สูงสุด 4MB ต่อใบ) — โหลดทีละใบเฉพาะตอนต้องส่งรูปให้ EasySlip
    select: {
      id: true,
      hash: true,
      mimeType: true,
      qrPayload: true,
      checkAttempts: true,
      order: {
        select: { orderNumber: true, slipHash: true, amount: true, createdAt: true, payment: { select: { promptpayTarget: true, promptpayAccountName: true } } },
      },
    },
  });
  // ลูกค้าแนบสลิปใบใหม่แล้ว = ใบเก่าไม่ต้องตรวจต่อ
  return uploads.filter((upload) => upload.order.slipHash === upload.hash);
}

type Candidate = Awaited<ReturnType<typeof findCandidates>>[number];

/** ตรวจครบจำนวนแล้วยังรอ = เลิกตรวจอัตโนมัติ ให้คนตัดสิน */
function finalize(result: SlipCheckResult, attempts: number): SlipCheckResult {
  if (result.status !== "PENDING" || attempts < SLIP_RECHECK_MAX_ATTEMPTS) return result;
  return { status: "ERROR", note: `ตรวจซ้ำครบ ${SLIP_RECHECK_MAX_ATTEMPTS} ครั้งแล้วยังไม่ได้คำตอบจากธนาคาร (${result.note}) — ตรวจด้วยตา` };
}

/** null = ระหว่างตรวจ สถานะถูกเปลี่ยนไปแล้ว (แอดมินตัดสิน/มีสลิปใบใหม่/รอบอื่นเขียนก่อน) — ไม่นับ ไม่แจ้ง */
async function recheckOne(db: PrismaClient, upload: Candidate, inspector: SlipInspector, now: Date): Promise<SlipCheckResult | null> {
  const attempts = upload.checkAttempts + 1;
  const image = upload.qrPayload
    ? new Uint8Array()
    : new Uint8Array((await db.slipUpload.findUniqueOrThrow({ where: { id: upload.id }, select: { data: true } })).data);
  const result = finalize(
    await inspector.check({
      qrPayload: upload.qrPayload ?? undefined,
      image: { bytes: image, mimeType: upload.mimeType },
      expectedAmount: upload.order.amount.toNumber(),
      orderCreatedAt: upload.order.createdAt,
      receiverIds: [upload.order.payment?.promptpayTarget ?? "", ...inspector.receiverAccounts].filter(Boolean),
      receiverAccountName: upload.order.payment?.promptpayAccountName ?? "",
      now,
    }),
    attempts,
  );
  // updateMany + เงื่อนไข PENDING: ไม่เขียนทับผลที่ได้แล้ว
  const where = { id: upload.id, checkStatus: "PENDING" as const };
  try {
    const { count } = await db.slipUpload.updateMany({ where, data: { checkAttempts: attempts, ...slipCheckFields(result, now) } });
    return count > 0 ? result : null;
  } catch (error) {
    if (!isUniqueViolation(error) || !result.transRef) throw error;
    // ธนาคารยืนยันว่าเป็นรายการโอนที่สลิปอื่นในระบบใช้ไปแล้ว
    const duplicate: SlipCheckResult = { status: "DUPLICATE", note: `เลขอ้างอิง ${result.transRef} ถูกใช้กับสลิปอื่นในระบบแล้ว — ห้ามอนุมัติจากสลิปนี้`, amount: result.amount, slipDate: result.slipDate };
    const { count } = await db.slipUpload.updateMany({ where, data: { checkAttempts: attempts, ...slipCheckFields(duplicate, now) } });
    return count > 0 ? duplicate : null;
  }
}

/**
 * ตรวจสลิปที่ธนาคารยังตอบไม่ได้ซ้ำ (เช่นสลิปกรุงเทพที่ยังไม่เข้าระบบ) — เรียกจาก GitHub Actions ทุก 10 นาที
 * ไม่มีสลิปรอ = ไม่บันทึก JobRun (กันตารางโตทุก 10 นาที); ได้ผลแล้วแจ้งกลุ่มแอดมินในข้อความเดียว
 */
export async function runSlipRecheck(
  db: PrismaClient,
  { now = new Date(), inspector = createSlipInspector(), alert = sendAdminTelegram }: { now?: Date; inspector?: SlipInspector; alert?: AdminAlert } = {},
): Promise<SlipRecheckOutcome> {
  const candidates = await findCandidates(db);
  if (candidates.length === 0) return { ok: true, skipped: true };

  return runJob(
    db,
    JOB_NAMES.SLIP_RECHECK,
    async () => {
      const summary: SlipRecheckSummary = { checked: 0, verified: 0, flagged: 0, stillPending: 0, gaveUp: 0, duplicates: 0, failed: 0 };
      const lines: string[] = [];
      let providerAlert: string | null = null;

      const deadline = Date.now() + RUN_BUDGET_MS;
      for (const upload of candidates) {
        if (Date.now() >= deadline) break;
        try {
          const result = await recheckOne(db, upload, inspector, now);
          if (!result) continue;
          summary.checked++;
          if (result.alertAdmins) providerAlert = result.note;
          if (result.status === "PENDING") {
            summary.stillPending++;
            continue;
          }
          if (result.status === "VERIFIED") summary.verified++;
          else if (result.status === "DUPLICATE") summary.duplicates++;
          else if (result.status === "ERROR" && !result.alertAdmins) summary.gaveUp++;
          else summary.flagged++;
          lines.push(`${result.status === "VERIFIED" ? "✅" : "⚠️"} ${upload.order.orderNumber}: ${SLIP_CHECK_LABELS[result.status]}`);
        } catch (error) {
          summary.failed++;
          console.error("[slip-recheck] ตรวจซ้ำไม่สำเร็จ", { uploadId: upload.id, error });
        }
      }

      // แจ้งปัญหาผู้ให้บริการไม่เกินชั่วโมงละครั้ง (รอบละ 10 นาที — ไม่งั้นกลุ่มแอดมินถูกถล่ม)
      const providerLine = providerAlert && shouldAlertProviderProblem(now) ? [`🚨 ระบบตรวจสลิปอัตโนมัติใช้งานไม่ได้ — ${providerAlert}`] : [];
      if (lines.length > 0 || providerLine.length > 0) {
        const message = [
          "🔁 ผลตรวจสลิปซ้ำกับธนาคาร",
          ...lines,
          ...providerLine,
          "ดูรายละเอียดที่หน้า /admin/orders",
        ].join("\n");
        const sent = await alert(message);
        if (!sent.ok) console.error("[slip-recheck] แจ้งผลตรวจซ้ำไม่สำเร็จ", { reason: sent.reason });
      }
      if (summary.failed > 0) throw new JobPartialFailure(`ตรวจสลิปซ้ำไม่สำเร็จ ${summary.failed} รายการ`, summary);
      return summary;
    },
    { alert },
  );
}
