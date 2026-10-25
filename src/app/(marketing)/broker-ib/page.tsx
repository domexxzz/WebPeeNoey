import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { BROKER_IB_CONTENT, BROKER_IB_FAQ } from "@/config/broker-ib";
import { buildBreadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/json-ld";
import { getCachedBrokerIbOffer } from "@/lib/broker-ib/public-offer";
import { PageHeader } from "@/components/marketing/page-header";
import { BrokerIbGuide } from "@/components/broker-ib/broker-ib-guide";

export async function generateMetadata(): Promise<Metadata> {
  const offer = await getCachedBrokerIbOffer();
  const metadata = buildPageMetadata({ title: "ใช้ฟรีผ่านโบรกเกอร์พาร์ทเนอร์", description: BROKER_IB_CONTENT.description, path: "/broker-ib" });
  // ปิดรับคำขอ = หน้านี้ 404 และไม่ให้เครื่องมือค้นหาเก็บไว้
  return offer.open ? metadata : { ...metadata, robots: { index: false, follow: false } };
}

export default async function BrokerIbPublicPage() {
  const offer = await getCachedBrokerIbOffer();
  if (!offer.open) notFound();

  return (
    <>
      <JsonLd data={buildBreadcrumbJsonLd([{ name: "ใช้ฟรีผ่านโบรกเกอร์พาร์ทเนอร์", path: "/broker-ib" }])} />
      <PageHeader eyebrow={BROKER_IB_CONTENT.eyebrow} title={BROKER_IB_CONTENT.title} description={BROKER_IB_CONTENT.description} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-14">
        <section aria-labelledby="ib-steps-heading" className="border border-line bg-surface p-6 sm:p-10 rounded-2xl">
          <h2 id="ib-steps-heading" className="font-display text-2xl font-bold text-fg">ขั้นตอนรับสิทธิ์</h2>
          <div className="mt-8">
            <BrokerIbGuide brokers={offer.brokers} />
          </div>
          <Link
            href="/account/broker-ib"
            className="mt-8 inline-flex items-center gap-2 bg-gold px-6 py-3.5 text-sm font-semibold text-fg transition-colors hover:bg-gold-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-ink rounded-xl"
          >
            ยื่นเลขบัญชีในหน้าสมาชิก <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </section>

        <section aria-labelledby="ib-faq-heading">
          <h2 id="ib-faq-heading" className="font-display text-2xl font-bold text-fg">คำถามที่พบบ่อย</h2>
          <dl className="mt-6 divide-y divide-line-soft border border-line bg-surface rounded-2xl">
            {BROKER_IB_FAQ.map((item) => (
              <div key={item.q} className="px-5 sm:px-6 py-5">
                <dt className="font-semibold text-fg">{item.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-fg-muted">{item.a}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm text-fg-muted">
            รายละเอียดเงื่อนไขทั้งหมดอยู่ใน{" "}
            <Link href="/terms" className="underline underline-offset-4 hover:text-gold-ink">
              ข้อกำหนดการใช้บริการ
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}
