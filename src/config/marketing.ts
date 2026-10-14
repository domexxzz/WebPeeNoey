/**
 * เนื้อหาหน้าบ้าน (Marketing Content) — รวมไว้ที่เดียวเพื่อให้แก้ไขง่ายและทดสอบได้
 *
 * กติกา (CLAUDE.md ข้อ 3): ห้ามใส่รีวิวปลอม สถิติกำไร หรือคำกล่าวอ้างความแม่นยำที่พิสูจน์ไม่ได้
 * ให้อธิบาย "สิ่งที่ได้รับ" และ "ขั้นตอนการใช้งาน" ตามระบบจริงเท่านั้น
 */

import { PAYMENT_RULES } from "./payment";

export interface NavLink {
  label: string;
  href: string;
}

export interface FeatureItem {
  id: string;
  icon: "chart" | "send" | "users" | "video" | "lifebuoy" | "lock";
  title: string;
  description: string;
}

export interface StepItem {
  step: number;
  title: string;
  description: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ImageSlotSpec {
  label: string;
  width: number;
  height: number;
  /** ค่า sizes ของ next/image ให้ตรงกับขนาดที่แสดงจริง */
  sizes: string;
}

/** id ของ section บนหน้าแรก — ใช้ร่วมกันระหว่าง nav และ section เพื่อไม่ให้ลิงก์หลุด */
export const HOME_SECTION_IDS = {
  features: "features",
  howItWorks: "how-it-works",
  pricing: "pricing",
  faq: "faq",
  contact: "contact",
} as const;

export const MAIN_NAV: NavLink[] = [
  { label: "จุดเด่น", href: `/#${HOME_SECTION_IDS.features}` },
  { label: "วิธีใช้งาน", href: `/#${HOME_SECTION_IDS.howItWorks}` },
  { label: "แพ็กเกจราคา", href: `/#${HOME_SECTION_IDS.pricing}` },
  { label: "ฟีเจอร์", href: "/features" },
  { label: "คู่มือ", href: "/guide" },
  { label: "คำถามพบบ่อย", href: `/#${HOME_SECTION_IDS.faq}` },
];

export const FOOTER_NAV: { title: string; links: NavLink[] }[] = [
  {
    title: "บริการ",
    links: [
      { label: "ฟีเจอร์ทั้งหมด", href: "/features" },
      { label: "แพ็กเกจราคา", href: `/#${HOME_SECTION_IDS.pricing}` },
      { label: "คู่มือการใช้งาน", href: "/guide" },
      { label: "ติดต่อเรา", href: `/#${HOME_SECTION_IDS.contact}` },
    ],
  },
  {
    title: "นโยบาย",
    links: [
      { label: "ข้อกำหนดการใช้บริการ", href: "/terms" },
      { label: "นโยบายความเป็นส่วนตัว", href: "/privacy" },
      { label: "นโยบายการคืนเงิน", href: "/refund" },
    ],
  },
];

export const HERO_CONTENT = {
  eyebrow: "TradingView Invite-only Indicator",
  // เว้นวรรคระหว่างวลี เพื่อให้หัวข้อตัดบรรทัดตรงจุดที่อ่านเป็นธรรมชาติ (ดู components/marketing/phrases.tsx)
  titleLead: "เครื่องมือวิเคราะห์กราฟ บน TradingView",
  titleHighlight: "พร้อมแจ้งเตือน และคอมมูนิตี้ ในที่เดียว",
  subtitle:
    "สมัครสมาชิก รับสิทธิ์ใช้อินดิเคเตอร์แบบ Invite-only บนบัญชี TradingView ของคุณ พร้อมกลุ่ม Telegram VIP สำหรับแจ้งเตือน และคอมมูนิตี้ Discord สำหรับแลกเปลี่ยนความรู้",
  highlights: [
    "ชำระผ่าน PromptPay QR สแกนได้ทุกธนาคาร",
    "ต่ออายุแบบทบวัน วันที่เหลืออยู่ไม่หาย",
    "ไม่มีการตัดเงินอัตโนมัติ ต่ออายุเมื่อคุณพร้อม",
  ],
  /** คำบรรยายใต้ภาพกราฟวาด (แสดงระหว่างโหลดกราฟจริง หรือเมื่อโหลดไม่ได้) — ไม่ใช่ผลการเทรด (CLAUDE.md ข้อ 3) */
  visualCaption: "ภาพประกอบเพื่ออธิบายการทำงานของเครื่องมือ ไม่ใช่ผลการเทรดจริง",
  /** คำบรรยายใต้กราฟจริงจาก TradingView — บอกชัดว่าไม่ได้แสดงสัญญาณของอินดิเคเตอร์เรา และไม่ใช่คำแนะนำการลงทุน */
  liveChartCaption: "กราฟราคาจริงแบบสดจาก TradingView — แสดงหน้าจอกราฟตัวอย่าง ไม่ได้แสดงสัญญาณของอินดิเคเตอร์ Gold Hybridshot และไม่ใช่คำแนะนำการลงทุน",
  /** แถบตัวอักษรเลื่อนใต้ Hero — ชื่อแบรนด์ซ้ำทั้งแถบ (ตัวทึบ/ตัวโปร่งสลับกัน) 3 คำต่อรอบ ให้ยาวเกินจอกว้างเพื่อวนต่อเนื่อง */
  marquee: ["Gold Hybridshot", "Gold Hybridshot", "Gold Hybridshot"],
};

export const FEATURES: FeatureItem[] = [
  {
    id: "indicator",
    icon: "chart",
    title: "อินดิเคเตอร์ Invite-only บน TradingView",
    description:
      "ระบบเปิดสิทธิ์ให้ตาม TradingView Username ที่คุณลงทะเบียนไว้ ใช้งานบนกราฟของคุณเองได้ทันทีหลังได้รับสิทธิ์",
  },
  {
    id: "telegram",
    icon: "send",
    title: "กลุ่ม Telegram VIP",
    description:
      "รับลิงก์เชิญเข้ากลุ่มส่วนตัวหลังคำสั่งซื้อได้รับอนุมัติ สำหรับติดตามการแจ้งเตือนและประกาศสำคัญ",
  },
  {
    id: "discord",
    icon: "users",
    title: "คอมมูนิตี้ Discord",
    description:
      "รับยศ VIP ใน Discord เพื่อเข้าห้องสมาชิก แลกเปลี่ยนมุมมองและวิธีใช้งานกับสมาชิกคนอื่น",
  },
  {
    id: "guides",
    icon: "video",
    title: "คู่มือและวิดีโอสอนการตั้งค่า",
    description:
      "คู่มือทีละขั้นตอนตั้งแต่การเพิ่มอินดิเคเตอร์ลงกราฟ ไปจนถึงการตั้งค่าที่เหมาะกับสไตล์การเทรดของคุณ",
  },
  {
    id: "support",
    icon: "lifebuoy",
    title: "ทีมช่วยเหลือทางเทคนิค",
    description:
      "ติดปัญหาเรื่องสิทธิ์ การเข้ากลุ่ม หรือการตั้งค่า ติดต่อทีมงานได้ผ่านช่องทางที่ระบุในหน้าเว็บ",
  },
  {
    id: "price-lock",
    icon: "lock",
    title: "ล็อกราคาสำหรับสมาชิก Early Bird",
    description:
      "สมาชิกกลุ่มแรกที่ได้รับราคาพิเศษ สามารถต่ออายุในราคาเดิมตามเงื่อนไขที่ระบุในข้อกำหนดการใช้บริการ",
  },
];

export const HOW_IT_WORKS: StepItem[] = [
  {
    step: 1,
    title: "สมัครสมาชิก",
    description:
      "กรอกชื่อ อีเมล รหัสผ่าน และ TradingView Username ให้ถูกต้อง เพราะระบบจะเปิดสิทธิ์ให้ตามชื่อผู้ใช้นี้",
  },
  {
    step: 2,
    title: "เลือกแพ็กเกจและสแกนจ่าย",
    description:
      `ระบบสร้าง PromptPay QR ที่ฝังยอดเงินไว้ให้ สแกนจ่ายผ่านแอปธนาคารได้ภายใน ${PAYMENT_RULES.paymentWindowMinutes} นาที`,
  },
  {
    step: 3,
    title: "แนบสลิปการโอน",
    description:
      "อัปโหลดสลิปในหน้าคำสั่งซื้อ ทีมงานจะตรวจสอบยอดเงินและแจ้งผลทางอีเมล",
  },
  {
    step: 4,
    title: "รับสิทธิ์และเริ่มใช้งาน",
    description:
      "เมื่ออนุมัติแล้ว ทีมงานจะเปิดสิทธิ์อินดิเคเตอร์และส่งช่องทางเข้ากลุ่มให้ ติดตามสถานะได้ในแดชบอร์ดสมาชิก",
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "อินดิเคเตอร์นี้รับประกันผลกำไรหรือไม่?",
    answer:
      "ไม่รับประกัน อินดิเคเตอร์เป็นเครื่องมือช่วยวิเคราะห์กราฟเท่านั้น ไม่ใช่คำแนะนำการลงทุน การตัดสินใจซื้อขายและความเสี่ยงทั้งหมดเป็นของผู้ใช้งาน",
  },
  {
    question: "ต้องใช้บัญชี TradingView แบบเสียเงินหรือไม่?",
    answer:
      "ไม่จำเป็น สิทธิ์ Invite-only ผูกกับ TradingView Username ของคุณ แต่บัญชีแต่ละระดับของ TradingView มีข้อจำกัดจำนวนอินดิเคเตอร์ต่อกราฟไม่เท่ากัน โปรดตรวจสอบเงื่อนไขของ TradingView",
  },
  {
    question: "ชำระเงินได้ช่องทางไหนบ้าง?",
    answer:
      "ชำระผ่าน PromptPay QR ที่ระบบสร้างให้พร้อมยอดเงิน สแกนได้จากแอปธนาคารทุกธนาคาร จากนั้นแนบสลิปในหน้าคำสั่งซื้อ",
  },
  {
    question: "หลังโอนเงินแล้วจะได้รับสิทธิ์เมื่อไหร่?",
    answer:
      "ทีมงานจะตรวจสอบสลิปและอนุมัติคำสั่งซื้อ เมื่ออนุมัติแล้วระบบจะส่งอีเมลยืนยัน และสิทธิ์ทุกช่องทางจะแสดงในแดชบอร์ดสมาชิก",
  },
  {
    question: "ถ้าต่ออายุก่อนหมดอายุ วันที่เหลือจะหายไหม?",
    answer:
      `ไม่หาย ระบบต่ออายุแบบทบวัน จำนวนวันของแพ็กเกจใหม่จะต่อจากวันหมดอายุเดิม และจะมีอีเมลเตือนล่วงหน้า ${PAYMENT_RULES.expiryReminderDays} วันก่อนหมดอายุ`,
  },
  {
    question: "มีการตัดเงินอัตโนมัติหรือไม่?",
    answer:
      "ไม่มี การชำระเงินทุกครั้งทำผ่าน PromptPay ด้วยตัวคุณเอง เมื่อสิทธิ์หมดอายุโดยไม่ได้ต่ออายุ ระบบจะปิดสิทธิ์อัตโนมัติ",
  },
  {
    question: "เปลี่ยน TradingView Username ภายหลังได้ไหม?",
    answer:
      "ได้ โปรดติดต่อทีมงานพร้อมอีเมลที่ใช้สมัคร ทีมงานจะย้ายสิทธิ์ไปยังชื่อผู้ใช้ใหม่ให้",
  },
  {
    question: "ขอคืนเงินได้หรือไม่?",
    answer:
      "ได้ตามเงื่อนไขในนโยบายการคืนเงิน โปรดอ่านรายละเอียดที่หน้านโยบายการคืนเงินก่อนชำระเงิน",
  },
];

/**
 * สเปกช่องวางรูปภาพ (ยังไม่มีไฟล์จริง — ใส่ src เมื่อได้รูปจากเจ้าของแล้ว)
 * แนะนำ: WebP/AVIF, ไม่เกิน 200KB ต่อรูป, เก็บไว้ใน /public/images
 */
export const IMAGE_SLOTS = {
  heroChart: {
    label: "ภาพหน้าจออินดิเคเตอร์บนกราฟ (Hero)",
    width: 1600,
    height: 900,
    sizes: "(min-width: 1280px) 1152px, (min-width: 768px) 90vw, 100vw",
  },
  featureScreenshot: {
    label: "ภาพประกอบฟีเจอร์",
    width: 1200,
    height: 750,
    sizes: "(min-width: 1024px) 560px, 100vw",
  },
  guideStep: {
    label: "ภาพหน้าจอประกอบขั้นตอน",
    width: 1280,
    height: 720,
    sizes: "(min-width: 1024px) 768px, 100vw",
  },
  ogImage: {
    label: "Open Graph (แชร์โซเชียล)",
    width: 1200,
    height: 630,
    sizes: "1200px",
  },
} satisfies Record<string, ImageSlotSpec>;

export const RISK_DISCLAIMER =
  "การลงทุนมีความเสี่ยง อินดิเคเตอร์และการแจ้งเตือนเป็นเครื่องมือช่วยวิเคราะห์เท่านั้น ไม่ใช่คำแนะนำการลงทุน ผลลัพธ์ในอดีตไม่ได้รับประกันผลลัพธ์ในอนาคต ผู้ใช้ควรศึกษาข้อมูลและประเมินความเสี่ยงก่อนตัดสินใจทุกครั้ง";

/**
 * กราฟจริงจาก TradingView (widget ทางการ "Advanced Real-Time Chart" ที่อนุญาตให้ฝังในเว็บ — ต้องคงลิงก์ระบุที่มาไว้)
 * เปลี่ยนสัญลักษณ์/กรอบเวลาได้ที่นี่ — https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/
 */
export const TRADINGVIEW_CHART = {
  scriptSrc: "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js",
  attributionHref: "https://www.tradingview.com/",
  config: {
    autosize: true,
    symbol: "OANDA:XAUUSD",
    interval: "240",
    timezone: "Asia/Bangkok",
    theme: "light",
    style: "1",
    locale: "th_TH",
    backgroundColor: "rgba(255, 255, 255, 1)",
    gridColor: "rgba(31, 26, 18, 0.06)",
    hide_side_toolbar: true,
    hide_volume: false,
    allow_symbol_change: true,
    save_image: false,
    calendar: false,
    support_host: "https://www.tradingview.com",
  },
} as const;

/**
 * ภาพหน้าจอจริงของอินดิเคเตอร์บน TradingView (เจ้าของบันทึกจากบัญชีตัวเอง)
 * ข้อความต้องอธิบายเฉพาะสิ่งที่เห็นในภาพ และระบุชัดว่าสถิติในตารางเป็นผลย้อนหลังบนกราฟ ไม่ใช่ผลเทรดจริง (CLAUDE.md ข้อ 3)
 */
export const INDICATOR_SHOWCASE = {
  id: "showcase",
  eyebrow: "ภาพหน้าจอจริงจาก TradingView",
  title: "หน้าตาอินดิเคเตอร์ บนกราฟจริง",
  description: "ตัวอย่างหน้าจอ Gold Hybridshot บนกราฟทองคำ — สัญญาณ จุดเป้าหมาย และจุดตัดขาดทุนแสดงบนกราฟให้เห็นทันที",
  image: {
    src: "/images/showcase/xauusd-5m-gold-hybridshot.png",
    width: 1752,
    height: 830,
    sizes: "(min-width: 1280px) 1200px, 100vw",
    alt: "ภาพหน้าจอกราฟทองคำ XAUUSD กรอบ 5 นาทีบน TradingView พร้อมอินดิเคเตอร์ Gold Hybridshot: ป้ายสัญญาณ BUY เส้นเป้าหมาย TP1 TP2 เส้นตัดขาดทุน SL เส้นแนวโน้ม และตารางสรุปมุมขวาบน",
  },
  meta: "XAUUSD (OANDA) · กรอบ 5 นาที · บันทึกภาพ 13 ต.ค. 2569",
  legend: [
    { title: "ป้ายสัญญาณ BUY", description: "ป้ายบนแท่งเทียนบอกจุดที่อินดิเคเตอร์ให้สัญญาณเข้าซื้อ" },
    { title: "เส้น TP1 · TP2 · SL", description: "เส้นเป้าหมายทำกำไรและจุดตัดขาดทุนที่อินดิเคเตอร์วาดให้บนกราฟ" },
    { title: "เส้นแนวโน้มและโซนสี", description: "เส้นและแถบสีช่วยดูทิศทางราคาและโซนที่ราคาเคลื่อนไหว" },
    { title: "ตารางสรุปมุมขวาบน", description: "สรุปแนวโน้ม สถานะสัญญาณล่าสุด และสถิติย้อนหลังของสัญญาณบนกราฟนั้น" },
  ],
  disclaimer:
    "ภาพหน้าจอจริงจาก TradingView ณ วันที่บันทึก ตัวเลขในตารางมุมขวาบน (เช่น Win Rate และจำนวนสัญญาณ) เป็นสถิติย้อนหลังที่อินดิเคเตอร์คำนวณเองบนกราฟนี้ ไม่ใช่ผลการเทรดจริงของสมาชิก อาจไม่รวมต้นทุนจริงเช่นสเปรดและค่าธรรมเนียม และไม่รับประกันผลในอนาคต — การลงทุนมีความเสี่ยง",
} as const;
