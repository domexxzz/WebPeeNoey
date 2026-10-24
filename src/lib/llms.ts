import { FAQ_ITEMS, RISK_DISCLAIMER } from "@/config/marketing";
import { SITE_PLANS } from "@/config/plans";
import { formatContactLine, siteConfig, type ContactInfo } from "@/config/site";
import { absoluteUrl } from "@/lib/seo";

interface LlmsTxtInput {
  contact: ContactInfo;
  /** หน้านโยบายฉบับร่างไม่ถูกแนะนำให้ AI อ้างอิง (สอดคล้องกับ sitemap) */
  isLegalDraft: boolean;
}

const link = (title: string, path: string, note: string) => `- [${title}](${absoluteUrl(path)}): ${note}`;

/**
 * /llms.txt ตามรูปแบบ llmstxt.org — สรุปเว็บให้ AI (ChatGPT, Perplexity, Claude ฯลฯ) อ่านแล้วอ้างอิงได้ถูกต้อง
 * สร้างจาก config จริงทั้งหมด: ห้ามใส่สถิติผลงาน/Win Rate/กำไร (CLAUDE.md ข้อ 3)
 */
export function buildLlmsTxt({ contact, isLegalDraft }: LlmsTxtInput): string {
  const pages = [
    link("หน้าแรก", "/", "ภาพรวมบริการ แพ็กเกจ ราคา และคำถามที่พบบ่อย"),
    link("ฟีเจอร์และสิ่งที่ได้รับ", "/features", "รายละเอียดสิทธิ์สมาชิกแต่ละช่องทาง"),
    link("คู่มือการใช้งาน", "/guide", "ขั้นตอนสมัคร ชำระเงิน เปิดใช้อินดิเคเตอร์ และต่ออายุ"),
  ];
  const legal = isLegalDraft
    ? []
    : [
        link("ข้อกำหนดการใช้บริการ", "/terms", "เงื่อนไขการใช้บริการ"),
        link("นโยบายความเป็นส่วนตัว", "/privacy", "การเก็บและใช้ข้อมูลส่วนบุคคล"),
        link("นโยบายการคืนเงิน", "/refund", "เงื่อนไขการขอคืนเงิน"),
      ];
  const hasContact = contact.email || contact.line || contact.telegram;

  return [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.description}`,
    "",
    "บริการสมาชิกแบบรายช่วงเวลา: สมาชิกชำระผ่าน PromptPay QR แนบสลิป แล้วทีมงานตรวจและเปิดสิทธิ์อินดิเคเตอร์ Invite-only บน TradingView ตาม TradingView Username ของสมาชิก พร้อมสิทธิ์กลุ่ม Telegram VIP และยศ VIP ใน Discord ต่ออายุแล้วนับต่อจากวันหมดอายุเดิม",
    "",
    "## หน้าหลัก",
    "",
    ...pages,
    "",
    "## แพ็กเกจและราคา (บาท)",
    "",
    ...SITE_PLANS.map((plan) => `- ${plan.name}: ${plan.price.toLocaleString("en-US")} บาท (${plan.durationLabel})`),
    "",
    "สิทธิ์ที่ได้รับ:",
    "",
    ...SITE_PLANS[0].features.map((feature) => `- ${feature}`),
    "",
    "## คำถามที่พบบ่อย",
    "",
    ...FAQ_ITEMS.flatMap((item) => [`### ${item.question}`, "", item.answer, ""]),
    "## คำเตือนความเสี่ยง",
    "",
    RISK_DISCLAIMER,
    ...(hasContact ? ["", "## ติดต่อ", "", formatContactLine(contact)] : []),
    ...(legal.length > 0 ? ["", "## Optional", "", ...legal] : []),
    "",
  ].join("\n");
}
