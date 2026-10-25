import type { Broker, PrismaClient } from "@prisma/client";
import type { ActorContext } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { approveBrokerClaim } from "./review";
import { evaluateClaimAgainstReport, type AccountEvidence, type ClaimVerdict } from "./report-import";
import { maskAccountNumber } from "./validation";

/**
 * อนุมัติคำขอสิทธิ์ผ่าน IB จากรายงานที่แอดมินอัปโหลด (แทนการเปิด Partner Portal ตรวจทีละคำขอ)
 * การอนุมัติทุกรายการผ่าน approveBrokerClaim เดิม (lock / ช่วงยื่น / AuditLog / Subscription) — ที่นี่เพิ่มแค่การตัดสินจากรายงาน
 */

export type EvidenceByBroker = Partial<Record<Broker, Map<string, AccountEvidence>>>;

export type ReportMatchVerdict = ClaimVerdict | "NO_REPORT_FOR_BROKER";

export interface ReportMatchRow {
  orderId: string;
  orderNumber: string;
  email: string;
  broker: Broker;
  accountMasked: string;
  verdict: ReportMatchVerdict;
  depositUsd: number | null;
  minDepositUsd: number | null;
  emailChecked: boolean;
}

const MAX_CLAIMS_PER_RUN = 200;

/** คำขอที่รอตรวจทั้งหมด (เก่าสุดก่อน) พร้อมผลเทียบกับรายงาน — ไม่แก้ข้อมูล */
export async function previewReportMatches(db: PrismaClient, evidenceByBroker: EvidenceByBroker): Promise<ReportMatchRow[]> {
  const claims = await db.order.findMany({
    where: { kind: "BROKER_IB", status: "CLAIM_SUBMITTED", brokerAccountId: { not: null } },
    orderBy: { createdAt: "asc" },
    take: MAX_CLAIMS_PER_RUN,
    select: {
      id: true,
      orderNumber: true,
      ibMinDepositUsd: true,
      user: { select: { email: true } },
      brokerAccount: { select: { broker: true, accountNumber: true, registeredEmail: true } },
    },
  });

  return claims.flatMap((order): ReportMatchRow[] => {
    const account = order.brokerAccount;
    if (!account) return [];
    const minDepositUsd = order.ibMinDepositUsd?.toNumber() ?? null;
    const base = { orderId: order.id, orderNumber: order.orderNumber, email: order.user.email, broker: account.broker, accountMasked: maskAccountNumber(account.accountNumber), minDepositUsd };
    const evidence = evidenceByBroker[account.broker];
    if (!evidence) return [{ ...base, verdict: "NO_REPORT_FOR_BROKER", depositUsd: null, emailChecked: false }];
    const result = evaluateClaimAgainstReport({ accountNumber: account.accountNumber, registeredEmail: account.registeredEmail, minDepositUsd }, evidence);
    return [{ ...base, ...result }];
  });
}

export interface ApproveFromReportResult {
  approved: (ReportMatchRow & { periodEnd: Date; isRenewal: boolean })[];
  /** ไม่ผ่านเงื่อนไขอัตโนมัติ — แอดมินตรวจเองในหน้าคำขอ */
  skipped: ReportMatchRow[];
  /** ผ่านเงื่อนไขแต่อนุมัติไม่ได้ (เช่น ถูกอนุมัติไปแล้ว, ยังไม่ถึงช่วงยื่น, ยื่นเอง) */
  failed: (ReportMatchRow & { code: string })[];
}

/**
 * อนุมัติเฉพาะคำขอที่ผ่านเงื่อนไขจากรายงาน — คำนวณใหม่จากไฟล์ทุกครั้ง (ไม่เชื่อรายการที่หน้าเว็บส่งมา)
 * รันซ้ำ/พร้อมกันได้: approveBrokerClaim ล็อกแถวออเดอร์ คำขอที่อนุมัติไปแล้วตอบ NOT_PENDING_REVIEW
 */
export async function approveQualifyingClaims(
  db: PrismaClient,
  input: { actor: ActorContext; evidenceByBroker: EvidenceByBroker; sourceFiles: string[]; now?: Date },
): Promise<ApproveFromReportResult> {
  const rows = await previewReportMatches(db, input.evidenceByBroker);
  const result: ApproveFromReportResult = { approved: [], skipped: [], failed: [] };
  const note = `อนุมัติอัตโนมัติจากรายงาน: ${input.sourceFiles.join(", ")}`.slice(0, 300);

  for (const row of rows) {
    if (row.verdict !== "QUALIFIES") {
      result.skipped.push(row);
      continue;
    }
    // แต่ละคำขอเป็น transaction ของตัวเอง — คำขอหนึ่งล้ม (เช่น deadlock) ต้องไม่ทำให้คำขอที่อนุมัติไปแล้วหายจากสรุป/อีเมล
    try {
      const approval = await approveBrokerClaim(db, {
        orderId: row.orderId,
        actor: input.actor,
        // รายงานไม่มีอีเมล = ข้ามการตรวจอีเมลตามนโยบายเจ้าของ (บันทึก emailChecked ไว้ใน note ของ AuditLog)
        checks: { underIb: true, emailMatches: true, qualifies: true },
        note: `${note}${row.emailChecked ? "" : " (รายงานไม่มีอีเมล — ไม่ได้เทียบอีเมล)"}`,
        now: input.now,
      });
      if (approval.ok) result.approved.push({ ...row, periodEnd: approval.periodEnd, isRenewal: approval.isRenewal });
      else result.failed.push({ ...row, code: approval.code });
    } catch (error) {
      console.error("[broker-ib] อนุมัติจากรายงานล้มเหลว", { orderNumber: row.orderNumber, error });
      result.failed.push({ ...row, code: "UNEXPECTED" });
    }
  }

  // สรุปการนำเข้า — เก็บเฉพาะจำนวนและเลขคำขอ ไม่เก็บเลขบัญชี/ยอดฝากของคำขอที่ไม่ผ่าน (PDPA)
  await writeAudit(db, {
    actor: input.actor,
    action: "BROKER_REPORT_IMPORT",
    targetType: "System",
    targetId: "broker-ib",
    details: {
      files: input.sourceFiles,
      brokers: Object.keys(input.evidenceByBroker),
      approved: result.approved.length,
      skipped: result.skipped.length,
      failed: result.failed.length,
      approvedOrders: result.approved.map((row) => row.orderNumber),
    },
  });
  return result;
}
