import { serializeJsonLd } from "@/lib/seo";

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // ข้อมูลมาจาก config ภายในเท่านั้น และผ่าน serializeJsonLd ที่ escape อักขระ <, >, & แล้ว
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
