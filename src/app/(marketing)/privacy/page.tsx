import type { Metadata } from "next";
import { PRIVACY_DOCUMENT } from "@/content/legal";
import { legalConfig } from "@/config/legal";
import { buildPageMetadata } from "@/lib/seo";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = buildPageMetadata({
  title: PRIVACY_DOCUMENT.title,
  description: PRIVACY_DOCUMENT.description,
  path: "/privacy",
  noIndex: legalConfig.isDraft,
});

export default function PrivacyPage() {
  return <LegalPage document={PRIVACY_DOCUMENT} />;
}
