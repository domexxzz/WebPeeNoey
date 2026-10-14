import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/page-guard";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { BROKERS, PLATFORMS } from "@/config/broker-ib";
import { AUDIT_ACTIONS, type AuditAction } from "@/lib/admin/audit";
import { getBrokerClaimDetail, type BrokerClaimDetail } from "@/lib/broker-ib/admin-query";
import { BROKER_REJECTION_PRESETS } from "@/lib/broker-ib/messages";
import { ActionForm } from "@/components/admin/action-form";
import { AdminCard, AdminOrderBadge, DefinitionList, inputClass, labelClass, SubscriptionBadge } from "@/components/admin/admin-ui";
import { ProvisioningPanel } from "@/components/admin/provisioning-panel";
import { approveBrokerClaimAction, rejectBrokerClaimAction } from "../../broker-ib-actions";

export const metadata: Metadata = { title: "ตรวจคำขอสิทธิ์ผ่าน IB", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const usd = (value: number | null) => (value === null ? "—" : `$${value.toLocaleString("en-US")}`);
const checkClass = "flex items-start gap-2 text-sm text-fg-muted";

function Warnings({ claim }: { claim: BrokerClaimDetail }) {
  const warnings = [
    claim.windowViolation && claim.nextPeriod
      ? `สมาชิกยังมีสิทธิ์ถึง ${formatDateTime(claim.nextPeriod.start)} (เหลือเกิน 7 วัน) — อนุมัติไม่ได้ตอนนี้`
      : null,
    claim.accountReleased ? "บัญชีเทรดนี้ถูกปลดการผูกหรือย้ายไปสมาชิกอื่นแล้ว — อนุมัติไม่ได้" : null,
    claim.previousClaimants.length > 0 ? `บัญชีนี้เคยถูกยื่นโดยสมาชิกอื่น: ${claim.previousClaimants.join(", ")}` : null,
    claim.emailDiffersFromMember ? "อีเมลที่ใช้กับโบรกเกอร์ไม่ตรงกับอีเมลสมาชิก — ตรวจให้แน่ใจว่าเป็นเจ้าของบัญชีจริง" : null,
    claim.status === "CLAIM_SUBMITTED" && !claim.availability.open ? "ขณะนี้ปิดรับคำขอใหม่ (คำขอนี้ยังตรวจได้)" : null,
  ].filter((warning): warning is string => warning !== null);
  if (warnings.length === 0) return null;
  return (
    <ul role="status" className="space-y-1.5 border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm text-orange-900 rounded-xl">
      {warnings.map((warning) => (
        <li key={warning} className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          {warning}
        </li>
      ))}
    </ul>
  );
}

function ReviewForms({ claim }: { claim: BrokerClaimDetail }) {
  return (
    <div className="grid gap-4">
      <AdminCard title={claim.isRenewal ? "อนุมัติการต่ออายุ" : "อนุมัติ"}>
        {claim.nextPeriod && (
          <p className="text-sm text-fg-muted">
            ถ้าอนุมัติ: สิทธิ์ {formatDateTime(claim.nextPeriod.start)} → {formatDateTime(claim.nextPeriod.end)} · วิธีตรวจ: ด้วยมือ (Partner Portal)
          </p>
        )}
        <ActionForm action={approveBrokerClaimAction} submitLabel="อนุมัติและเปิดสิทธิ์" pendingLabel="กำลังอนุมัติ...">
          <input type="hidden" name="orderId" value={claim.id} />
          <label className={checkClass}>
            <input type="checkbox" name="checkUnderIb" required className="mt-1 accent-[#B8860B]" />
            พบบัญชี {claim.brokerAccount ? `${claim.brokerAccount.platform} ${claim.brokerAccount.accountNumber}` : ""} ภายใต้ IB ของเราใน Partner Portal
          </label>
          <label className={checkClass}>
            <input type="checkbox" name="checkEmail" required className="mt-1 accent-[#B8860B]" />
            อีเมลในระบบโบรกเกอร์ตรงกับ {claim.brokerAccount?.registeredEmail}
          </label>
          <label className={checkClass}>
            <input type="checkbox" name="checkQualifies" required className="mt-1 accent-[#B8860B]" />
            {claim.isRenewal ? "บัญชียังใช้งานตามเงื่อนไข (ยังอยู่ภายใต้ IB และมีความเคลื่อนไหว)" : `ฝากเงินครั้งแรกแล้วอย่างน้อย ${usd(claim.minDepositAtSubmission)}`}
          </label>
          <div>
            <label className={labelClass} htmlFor="note">บันทึก (เฉพาะแอดมินเห็น)</label>
            <input id="note" name="note" maxLength={300} autoComplete="off" className={inputClass} />
          </div>
        </ActionForm>
      </AdminCard>
      <AdminCard title="ปฏิเสธ">
        <ActionForm action={rejectBrokerClaimAction} submitLabel="ปฏิเสธคำขอ" pendingLabel="กำลังบันทึก..." tone="danger">
          <input type="hidden" name="orderId" value={claim.id} />
          <div>
            <label className={labelClass} htmlFor="reasonPreset">เหตุผล</label>
            <select id="reasonPreset" name="reasonPreset" className={inputClass} defaultValue="">
              <option value="">— เลือกเหตุผล —</option>
              {BROKER_REJECTION_PRESETS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="reasonDetail">รายละเอียดเพิ่มเติม (สมาชิกจะเห็นข้อความนี้)</label>
            <textarea id="reasonDetail" name="reasonDetail" rows={2} maxLength={200} className={inputClass} />
          </div>
          <label className={checkClass}>
            <input type="checkbox" name="releaseAccount" defaultChecked={!claim.isRenewal} className="mt-1 accent-red-500" />
            <span>
              ปลดการผูกบัญชีเทรดนี้
              <span className="block text-xs text-fg-subtle">ปลดแล้วสมาชิกคนใดก็ยื่นบัญชีนี้ได้ (เช่น มีคนยื่นบัญชีของคนอื่นดักไว้) — ไม่ปลด = สมาชิกคนนี้ยื่นบัญชีเดิมใหม่ได้</span>
            </span>
          </label>
        </ActionForm>
      </AdminCard>
    </div>
  );
}

export default async function AdminBrokerClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage();
  const claim = await getBrokerClaimDetail(prisma, { orderId: id });
  if (!claim) notFound();
  const account = claim.brokerAccount;

  return (
    <div className="space-y-6">
      <Link href="/admin/broker-claims" className="inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> กลับไปรายการคำขอ
      </Link>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-bold text-fg">{claim.orderNumber}</h1>
        <AdminOrderBadge status={claim.status} />
        {claim.isRenewal && <span className="text-xs text-fg-subtle">ต่ออายุ</span>}
      </header>

      <Warnings claim={claim} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <AdminCard title="บัญชีเทรดที่ยื่น">
            {account ? (
              <>
                <p className="font-mono text-3xl font-bold text-gold-ink select-all">{account.accountNumber}</p>
                <DefinitionList
                  items={[
                    { label: "โบรกเกอร์ / แพลตฟอร์ม", value: `${BROKERS[account.broker].label} · ${PLATFORMS[account.platform]}` },
                    { label: "อีเมลที่สมัครกับโบรกเกอร์", value: <span className="select-all">{account.registeredEmail}</span> },
                    { label: "ฝากขั้นต่ำ ณ เวลายื่น", value: usd(claim.minDepositAtSubmission) },
                    { label: "ฝากขั้นต่ำปัจจุบัน", value: usd(claim.currentMinDeposit) },
                    { label: "ยืนยันครั้งแรก", value: account.firstVerifiedAt ? formatDateTime(account.firstVerifiedAt) : "ยังไม่เคย" },
                    { label: "ยืนยันล่าสุด", value: account.lastVerifiedAt ? formatDateTime(account.lastVerifiedAt) : "—" },
                  ]}
                />
              </>
            ) : (
              <p className="text-sm text-fg-subtle">ไม่พบข้อมูลบัญชีเทรด</p>
            )}
          </AdminCard>

          <AdminCard title="สมาชิก">
            <DefinitionList
              items={[
                { label: "อีเมลสมาชิก", value: <Link href={`/admin/members/${claim.user.id}`} className="text-gold-ink hover:underline">{claim.user.email}</Link> },
                { label: "TradingView Username", value: claim.user.tradingViewUsername ?? "—" },
                { label: "Discord User ID", value: claim.user.discordUserId ?? "—" },
                { label: "ยื่นเมื่อ", value: formatDateTime(claim.createdAt) },
                { label: "ยอมรับข้อกำหนด", value: claim.termsAcceptedAt ? `${formatDateTime(claim.termsAcceptedAt)} (v${claim.termsVersion}) · IP ${claim.createdIp ?? "—"}` : "—" },
              ]}
            />
            {claim.rejectionReason && <p className="text-sm text-red-700">เหตุผลที่ปฏิเสธ: {claim.rejectionReason}</p>}
          </AdminCard>
        </div>

        <div className="space-y-6">
          {claim.status === "CLAIM_SUBMITTED" && <ReviewForms claim={claim} />}

          {claim.subscription && (
            <AdminCard title="สิทธิ์จากคำขอนี้">
              <div className="flex flex-wrap items-center gap-3 text-sm text-fg-muted">
                <SubscriptionBadge status={claim.subscription.status} />
                {formatDateTime(claim.subscription.currentPeriodStart)} → {formatDateTime(claim.subscription.currentPeriodEnd)}
              </div>
              <ProvisioningPanel subscription={claim.subscription} />
            </AdminCard>
          )}

          <AdminCard title="ประวัติการดำเนินการ">
            {claim.auditLogs.length === 0 ? (
              <p className="text-sm text-fg-subtle">ยังไม่มี</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {claim.auditLogs.map((log) => (
                  <li key={log.id} className="text-fg-muted">
                    <span className="text-fg">{AUDIT_ACTIONS[log.action as AuditAction] ?? log.action}</span> โดย {log.actorEmail} ·{" "}
                    <span className="text-fg-subtle">{formatDateTime(log.createdAt)}</span>
                  </li>
                ))}
              </ol>
            )}
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
