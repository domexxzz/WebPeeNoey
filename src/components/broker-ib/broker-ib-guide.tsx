import { AlertTriangle, ExternalLink, Info } from "lucide-react";
import { BROKER_IB_CONTENT, fillMinDeposit } from "@/config/broker-ib";
import type { BrokerOffer } from "@/lib/broker-ib/availability";
import { BrokerTransferGuide } from "./broker-transfer-guide";

export { BrokerTransferGuide };

interface BrokerIbGuideProps {
  brokers: BrokerOffer[];
}

/** ขั้นตอน + ลิงก์พาร์ทเนอร์ + คำเตือนความเสี่ยง + การเปิดเผยค่าตอบแทน (ใช้ทั้งหน้าสมาชิกและหน้าเว็บสาธารณะ) */
export function BrokerIbSteps({ brokers }: { brokers: BrokerOffer[] }) {
  return (
    <ol className="space-y-4">
      {BROKER_IB_CONTENT.steps.map((step, index) => (
        <li key={step.title} className="flex gap-4">
          <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold font-display text-sm font-bold text-fg">
            {index + 1}
          </span>
          <div>
            <p className="font-semibold text-fg">{fillMinDeposit(step.title, brokers)}</p>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** ลิงก์ไปโบรกเกอร์ — rel="sponsored" ตามแนวปฏิบัติลิงก์ที่มีค่าตอบแทน, เปิดแท็บใหม่โดยไม่ส่ง opener/referrer */
export function BrokerLinks({ brokers }: { brokers: BrokerOffer[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {brokers.map((offer) => (
        <a
          key={offer.broker}
          href={offer.link}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="inline-flex items-center gap-2 border border-gold bg-surface px-5 py-3 text-sm font-semibold text-fg transition-colors hover:bg-gold-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-ink rounded-xl"
        >
          เปิดบัญชี {offer.label}
          <ExternalLink className="w-4 h-4 text-gold-ink" aria-hidden="true" />
          <span className="sr-only">(เปิดในแท็บใหม่)</span>
        </a>
      ))}
    </div>
  );
}

export function BrokerIbRiskNotes() {
  return (
    <div className="space-y-3">
      <div role="note" className="flex gap-3 border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm leading-relaxed text-orange-900 rounded-xl">
        <AlertTriangle className="w-5 h-5 shrink-0 text-orange-700" aria-hidden="true" />
        <ul className="space-y-1.5">
          {BROKER_IB_CONTENT.risks.map((risk) => (
            <li key={risk}>{risk}</li>
          ))}
        </ul>
      </div>
      <p className="flex gap-2 text-xs leading-relaxed text-fg-subtle">
        <Info className="w-4 h-4 shrink-0 text-gold-ink" aria-hidden="true" />
        {BROKER_IB_CONTENT.disclosure}
      </p>
    </div>
  );
}

export function BrokerIbGuide({ brokers }: BrokerIbGuideProps) {
  return (
    <div className="space-y-6">
      <BrokerIbSteps brokers={brokers} />
      <BrokerLinks brokers={brokers} />
      <BrokerTransferGuide />
      <BrokerIbRiskNotes />
    </div>
  );
}
