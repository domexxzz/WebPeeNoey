import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { buildPageMetadata, buildProductJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/json-ld";
import { HeroSection } from "@/components/marketing/hero-section";
import { FeaturesSection } from "@/components/marketing/features-section";
import { IndicatorShowcaseSection } from "@/components/marketing/indicator-showcase-section";
import { HowItWorksSection } from "@/components/marketing/how-it-works-section";
import { PricingSection } from "@/components/marketing/pricing-section";
import { BrokerIbSection } from "@/components/marketing/broker-ib-section";
import { getCachedBrokerIbOffer } from "@/lib/broker-ib/public-offer";
import { FaqSection } from "@/components/marketing/faq-section";
import { ContactSection } from "@/components/marketing/contact-section";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: `${siteConfig.name} — อินดิเคเตอร์ TradingView พร้อมกลุ่มแจ้งเตือนและคอมมูนิตี้`,
    description: siteConfig.description,
    path: "/",
  }),
  // หน้าแรกใช้ชื่อเต็มโดยไม่ต่อท้ายด้วย template ของ root layout
  title: { absolute: `${siteConfig.name} — อินดิเคเตอร์ TradingView พร้อมกลุ่มแจ้งเตือนและคอมมูนิตี้` },
};

export default async function HomePage() {
  // ทางเลือกใช้งานฟรีผ่าน IB แสดงเฉพาะเมื่อแอดมินเปิดรับคำขอ (แคชไว้ + รีเฟรชทันทีเมื่อแก้การตั้งค่า)
  const brokerOffer = await getCachedBrokerIbOffer();
  return (
    <>
      <JsonLd data={buildProductJsonLd()} />
      <HeroSection />
      <FeaturesSection />
      <IndicatorShowcaseSection />
      <HowItWorksSection />
      <PricingSection />
      {brokerOffer.open && <BrokerIbSection brokers={brokerOffer.brokers} minDepositUsd={brokerOffer.minDepositUsd} />}
      <FaqSection />
      <ContactSection />
    </>
  );
}
