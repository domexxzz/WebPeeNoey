import Link from "next/link";
import { ArrowRight, Clock, Hourglass, XCircle } from "lucide-react";
import { BROKERS, BROKER_IB_CONTENT, PLATFORMS, BROKER_IB_RULES} from "@/config/broker-ib";
import { formatDate } from "@/lib/format";
import { ORDER_PHASE_LABELS } from "@/lib/orders/messages";
import type { BrokerIbMemberStatus } from "@/lib/broker-ib/member-status";
import { OrderStatusBadge } from "@/components/checkout/order-status-badge";
import { BrokerIbGuide, BrokerIbRiskNotes } from "@/components/broker-ib/broker-ib-guide";
import { BrokerClaimForm } from "./broker-claim-form";

const cardClass = "border border-line bg-surface p-6 sm:p-8 rounded-2xl";

function PaidPlansLink() {
  return (
    <Link href="/#pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-ink hover:text-gold-ink">
      ดูแพ็กเกจแบบชำระเงิน <ArrowRight className="w-4 h-4" aria-hidden="true" />
    </Link>
  );
}

function Rejection({ reason, at }: { reason: string; at: Date }) {
  return (
    <p role="status" className="flex items-start gap-2 border border-red-500/30 bg-red-50 px-4 py-3 text-sm text-red-800 rounded-xl">
      <XCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        คำขอล่าสุดไม่ผ่านการตรวจสอบ ({formatDate(at)}): {reason} — แก้ไขแล้วยื่นใหม่ได้
      </span>
    </p>
  );
}

function History({ history }: { history: BrokerIbMemberStatus["history"] }) {
  if (history.length === 0) return null;
  return (
    <section aria-labelledby="broker-history-heading" className="border border-line rounded-2xl overflow-hidden">
      <h2 id="broker-history-heading" className="border-b border-line px-5 sm:px-6 py-4 font-display text-lg font-bold text-fg">
        ประวัติคำขอ
      </h2>
      <ul className="divide-y divide-line-soft">
        {history.map((item) => (
          <li key={item.orderId} className="flex flex-col gap-2 bg-surface px-5 sm:px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-sm text-fg">{item.orderNumber}</p>
              <p className="mt-1 text-xs text-fg-subtle">
                {item.broker ? `${BROKERS[item.broker].label} ${item.accountMasked ?? ""} · ` : ""}
                ยื่นเมื่อ {formatDate(item.createdAt)}
                {item.status === "REJECTED" && item.rejectionReason ? ` · ${item.rejectionReason}` : ""}
              </p>
            </div>
            <OrderStatusBadge phase={item.status === "PENDING_PAYMENT" ? "AWAITING_PAYMENT" : item.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** หน้าสิทธิ์ผ่านโบรกเกอร์ของสมาชิก — แสดงตามสถานะ (รอตรวจ / ปิดรับ / รอช่วงต่ออายุ / ต่ออายุ / ยื่นใหม่) */
export function BrokerIbStatus({ status, memberEmail }: { status: BrokerIbMemberStatus; memberEmail: string }) {
  const { state, availability } = status;
  return (
    <div className="space-y-6">
      {state.kind === "PENDING" && (
        <section className={cardClass}>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-fg">
            <Hourglass className="w-5 h-5 text-gold-ink" aria-hidden="true" />
            รอทีมงานตรวจสอบบัญชี
          </h2>
          <p className="mt-3 text-sm text-fg-muted">
            คำขอ <span className="font-mono text-fg">{state.claim.orderNumber}</span>
            {state.claim.isRenewal ? " (ต่ออายุ)" : ""} · {BROKERS[state.claim.broker].label} {PLATFORMS[state.claim.platform]} บัญชี{" "}
            <span className="font-mono text-fg">{state.claim.accountMasked}</span> · ยื่นเมื่อ {formatDate(state.claim.submittedAt)}
          </p>
          <p className="mt-2 text-sm text-fg-muted">ทีมงานจะตรวจใน Partner Portal ของโบรกเกอร์และแจ้งผลทางอีเมล — {ORDER_PHASE_LABELS.CLAIM_SUBMITTED.label}</p>
        </section>
      )}

      {state.kind === "CLOSED" && (
        <section className={cardClass}>
          <h2 className="font-display text-xl font-bold text-fg">ขณะนี้ปิดรับคำขอสิทธิ์ผ่านโบรกเกอร์ชั่วคราว</h2>
          {state.ibActiveUntil && <p className="mt-3 text-sm text-fg-muted">สิทธิ์ผ่าน IB ปัจจุบันของคุณยังใช้ได้ถึง {formatDate(state.ibActiveUntil)}</p>}
          <div className="mt-4">
            <PaidPlansLink />
          </div>
        </section>
      )}

      {state.kind === "WAIT_WINDOW" && (
        <section className={cardClass}>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-fg">
            <Clock className="w-5 h-5 text-gold-ink" aria-hidden="true" />
            คุณยังมีสิทธิ์ใช้งานถึง {formatDate(state.coveredUntil)}
          </h2>
          <p className="mt-3 text-sm text-fg-muted">
            ยื่นคำขอสิทธิ์ผ่านโบรกเกอร์ได้ตั้งแต่วันที่ {formatDate(state.opensAt)} ({BROKER_IB_RULES.renewalWindowDays} วันก่อนสิทธิ์หมด) — วันใช้งานจะทบต่อจากวันหมดอายุเดิม
          </p>
        </section>
      )}

      {state.kind === "CAN_RENEW" && availability.open && (
        <section className={`${cardClass} space-y-5`}>
          <h2 className="font-display text-xl font-bold text-fg">ต่อสิทธิ์ผ่านโบรกเกอร์</h2>
          {state.ibActiveUntil && <p className="text-sm text-fg-muted">สิทธิ์ปัจจุบันใช้ได้ถึง {formatDate(state.ibActiveUntil)} — ต่อแล้ววันใช้งานทบต่อทันที</p>}
          {state.lastRejection && <Rejection {...state.lastRejection} />}
          <BrokerClaimForm
            mode="RENEW"
            accountLabel={`${BROKERS[state.binding.broker].label} ${state.binding.accountMasked}`}
            noPasswordNote={BROKER_IB_CONTENT.noPasswordNote}
          />
          <BrokerIbRiskNotes />
        </section>
      )}

      {state.kind === "CAN_CLAIM" && availability.open && (
        <>
          <section className={cardClass}>
            <h2 className="font-display text-xl font-bold text-fg">ขั้นตอนรับสิทธิ์</h2>
            <div className="mt-6">
              <BrokerIbGuide brokers={availability.brokers} />
            </div>
          </section>
          <section className={`${cardClass} space-y-5`}>
            <h2 className="font-display text-xl font-bold text-fg">ยื่นเลขบัญชีเทรด</h2>
            {state.lastRejection && <Rejection {...state.lastRejection} />}
            <BrokerClaimForm
              mode="NEW"
              brokers={availability.brokers.map(({ broker, label, minDepositThb }) => ({ broker, label, minDepositThb }))}
              defaultEmail={memberEmail}
              noPasswordNote={BROKER_IB_CONTENT.noPasswordNote}
            />
          </section>
        </>
      )}

      <History history={status.history} />
    </div>
  );
}
