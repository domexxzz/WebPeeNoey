import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BROKER_IB_CONTENT } from "@/config/broker-ib";
import type { BrokerOffer } from "@/lib/broker-ib/availability";
import { BrokerIbRiskNotes, BrokerIbSteps, BrokerLinks, BrokerTransferGuide } from "@/components/broker-ib/broker-ib-guide";
import { SectionHeading } from "./section-heading";

export const BROKER_IB_SECTION_ID = "broker-ib";

/**
 * ทางเลือกใช้งานฟรีผ่าน IB บนหน้าแรก (แสดงเฉพาะเมื่อแอดมินเปิดรับคำขอ — ผู้เรียกตรวจ offer.open แล้ว)
 * ห้ามรีวิว/ตัวเลขผลงาน, มีคำเตือนความเสี่ยงและการเปิดเผยค่าตอบแทนเสมอ
 */
export function BrokerIbSection({ brokers }: { brokers: BrokerOffer[] }) {
  return (
    <section aria-labelledby={`${BROKER_IB_SECTION_ID}-heading`} id={BROKER_IB_SECTION_ID} className="scroll-mt-20 border-b border-line">
      <div className="px-4 sm:px-6 lg:px-10 py-20 sm:py-28">
        <SectionHeading id={`${BROKER_IB_SECTION_ID}-heading`} eyebrow={BROKER_IB_CONTENT.eyebrow} title={BROKER_IB_CONTENT.title} description={BROKER_IB_CONTENT.description} />

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div data-reveal="up" className="border border-line bg-surface p-6 sm:p-8 rounded-2xl">
            <BrokerIbSteps brokers={brokers} />
          </div>
          <div data-reveal="up" className="flex flex-col gap-6">
            <BrokerLinks brokers={brokers} />
            <BrokerTransferGuide />
            <Link
              href="/account/broker-ib"
              className="inline-flex items-center justify-center gap-2 bg-gold px-6 py-3.5 text-sm font-semibold text-fg transition-colors hover:bg-gold-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-ink rounded-xl"
            >
              ยื่นเลขบัญชีในหน้าสมาชิก <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <BrokerIbRiskNotes />
            <Link href="/broker-ib" className="text-sm font-semibold text-gold-ink underline underline-offset-4 hover:text-gold-ink">
              อ่านเงื่อนไขและคำถามที่พบบ่อย
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
