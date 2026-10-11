import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { buildPageMetadata, buildProductJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/json-ld";
import { HeroSection } from "@/components/marketing/hero-section";
import { FeaturesSection } from "@/components/marketing/features-section";
import { HowItWorksSection } from "@/components/marketing/how-it-works-section";
import { PricingSection } from "@/components/marketing/pricing-section";
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

export default function HomePage() {
  return (
    <>
      <JsonLd data={buildProductJsonLd()} />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <FaqSection />
      <ContactSection />
    </>
  );
}
