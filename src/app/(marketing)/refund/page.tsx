import type { Metadata } from "next";
import { REFUND_DOCUMENT } from "@/content/legal";
import { legalConfig } from "@/config/legal";
import { buildPageMetadata } from "@/lib/seo";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = buildPageMetadata({
  title: REFUND_DOCUMENT.title,
  description: REFUND_DOCUMENT.description,
  path: "/refund",
  noIndex: legalConfig.isDraft,
});

export default function RefundPage() {
  return <LegalPage document={REFUND_DOCUMENT} />;
}
