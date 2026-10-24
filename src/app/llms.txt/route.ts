import { legalConfig } from "@/config/legal";
import { siteConfig } from "@/config/site";
import { buildLlmsTxt } from "@/lib/llms";

// เนื้อหามาจาก config/env ที่ฝังตอน build เท่านั้น — สร้างครั้งเดียวตอน build
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(buildLlmsTxt({ contact: siteConfig.contact, isLegalDraft: legalConfig.isDraft }), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
