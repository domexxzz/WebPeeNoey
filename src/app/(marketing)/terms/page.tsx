import type { Metadata } from "next";
import { TERMS_DOCUMENT } from "@/content/legal";
import { legalConfig } from "@/config/legal";
import { buildPageMetadata } from "@/lib/seo";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = buildPageMetadata({
  title: TERMS_DOCUMENT.title,
  description: TERMS_DOCUMENT.description,
  path: "/terms",
  noIndex: legalConfig.isDraft,
});

export default function TermsPage() {
  return <LegalPage document={TERMS_DOCUMENT} />;
}
