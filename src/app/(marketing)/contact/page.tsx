import type { Metadata } from "next";
import { buildBreadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/json-ld";
import { ContactProfile } from "@/components/marketing/contact-profile";

/**
 * หน้ารวมช่องทางติดต่อแบบลิงก์เดียว สำหรับแปะในไบโอ Facebook / TikTok / IG
 * ใช้แทนบริการรวมลิงก์ของเจ้าอื่น เพราะอยู่บนโดเมนตัวเอง และกดต่อไปดูแพ็กเกจได้ทันที
 */
export const metadata: Metadata = buildPageMetadata({
  title: "ติดต่อเรา",
  description:
    "ช่องทางติดต่อทีมงาน Gold Hybridshot ทั้งหมดในหน้าเดียว — LINE Official, Telegram, Discord และอีเมล พร้อมทางเข้าดูแพ็กเกจและสิทธิ์ใช้งานฟรีผ่านโบรกเกอร์พาร์ทเนอร์",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <JsonLd data={buildBreadcrumbJsonLd([{ name: "ติดต่อเรา", path: "/contact" }])} />
      <ContactProfile />
    </>
  );
}
