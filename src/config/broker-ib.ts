import type { Broker, TradingPlatform } from "@prisma/client";
import { SITE_PLANS } from "./plans";

/**
 * สิทธิ์ใช้งานฟรีผ่าน IB โบรกเกอร์ (XM / Exness)
 * สมาชิกเปิดบัญชีเทรดผ่านลิงก์พาร์ทเนอร์ + ฝากเงินครั้งแรกถึงขั้นต่ำ → ยื่นเลขบัญชีในหน้าสมาชิก → แอดมินตรวจใน Partner Portal
 * ลิงก์พาร์ทเนอร์และยอดฝากขั้นต่ำตั้งที่ /admin/settings (ห้ามเขียนตายตัวในโค้ด)
 */

/** แพ็กเกจของสิทธิ์ผ่าน IB — แยกจาก SITE_PLANS เพราะหน้าราคา / JSON-LD / บัตรสมาชิกอ่าน SITE_PLANS (ห้ามขายผ่าน Checkout) */
export const BROKER_IB_PLAN = {
  id: "plan_broker_ib",
  slug: "broker-ib",
  name: "สิทธิ์ใช้งานผ่านโบรกเกอร์พาร์ทเนอร์ (IB) 7 วัน",
  durationDays: 7,
  // สิทธิ์เดียวกับแพ็กเกจเริ่มต้น ยกเว้นการล็อกราคา (สิทธิ์ฟรีไม่มีราคาให้ล็อก)
  features: SITE_PLANS[0].features.filter((feature) => !feature.includes("ล็อกราคา")),
  sortOrder: 100,
} as const;

export const BROKER_IB_RULES = {
  /**
   * ยื่นขอสิทธิ์ (ครั้งแรก/ต่ออายุ) ได้เมื่อสิทธิ์ที่มีอยู่เหลือไม่เกินกี่วัน — กันสะสมสิทธิ์ฟรีล่วงหน้า
   * ต้องสั้นกว่า BROKER_IB_PLAN.durationDays เสมอ ไม่งั้นหน้าต่างเปิดค้างตั้งแต่วินาทีที่เพิ่งอนุมัติ
   * และสมาชิกยื่นต่อซ้ำได้ไม่รู้จบจากการฝากเงินครั้งเดียว (tests/broker-ib-rules.test.ts ดักไว้)
   */
  renewalWindowDays: 2,
  /** MT4/MT5 Login เป็นตัวเลขล้วน */
  accountNumberPattern: /^\d{5,12}$/,
  /** ยอดฝากขั้นต่ำตั้งเป็นเงินบาทแยกรายโบรกเกอร์ (ลูกค้าไทยฝากเป็นบาท) */
  minDepositThb: { min: 1, max: 1_000_000 },
  /** อัตราแลกเปลี่ยน USD/THB ที่แอดมินตั้งไว้ — ใช้แปลงขั้นต่ำเป็น USD เพื่อเทียบกับรายงานโบรกเกอร์ */
  /** ช่วงแคบพอที่จะดักการพิมพ์ผิด — อัตราผิดทำให้ขั้นต่ำที่แปลงแล้วเพี้ยนและอนุมัติอัตโนมัติผิดตาม */
  usdThbRate: { min: 25, max: 50 },
  /**
   * ผ่อนผันยอดฝากได้ 5% — โบรกเกอร์แปลงบาทเป็น USD ด้วยอัตราของตัวเองคนละเวลา
   * ยอดในรายงานจึงต่ำกว่าขั้นต่ำที่คำนวณไว้เล็กน้อยได้ทั้งที่ลูกค้าฝากครบ
   */
  depositTolerance: 0.05,
  linkMaxLength: 500,
  /** คำขอที่รอตรวจนานเกินนี้ → Watchdog แจ้งแอดมิน */
  claimReviewOverdueHours: 24,
  /** จำกัดการยื่นคำขอต่อสมาชิก และต่อ IP (กันสร้างบัญชีหลายบัญชีมายื่นถล่มคิว) */
  claimRateLimit: { max: 5, windowSeconds: 600 },
  claimIpRateLimit: { max: 20, windowSeconds: 3600 },
  /** แจ้งแอดมินเรื่องมีคนยื่นบัญชีที่ผูกแล้วได้ไม่เกิน 1 ครั้งต่อบัญชีต่อช่วงเวลานี้ */
  conflictAlertWindowSeconds: 3600,
} as const;

export const BROKERS: Record<Broker, { label: string; knownHosts: readonly string[] }> = {
  // โดเมนที่รู้จัก (รวมโดเมนติดตามลิงก์พาร์ทเนอร์) — ใช้แค่เตือนแอดมินเมื่อลิงก์ไม่ใช่โดเมนเหล่านี้ ไม่บล็อก
  XM: { label: "XM", knownHosts: ["xm.com", "xmglobal.com", "xmtrading.com", "pipaffiliates.com"] },
  EXNESS: { label: "Exness", knownHosts: ["exness.com", "exness.link", "exnesstrack.org", "exnesstrack.net", "exness-track.com", "exnessaffiliates.com", "exnessonelink.com"] },
};

/** ลำดับแสดงผล */
export const BROKER_ORDER: readonly Broker[] = ["XM", "EXNESS"];

export const PLATFORMS: Record<TradingPlatform, string> = {
  MT4: "MetaTrader 4 (MT4)",
  MT5: "MetaTrader 5 (MT5)",
};

/** รหัสพันธมิตร (Partner Code) สำหรับเปิดบัญชีย่อย หรือขอย้ายสายงาน */
export const BROKER_PARTNER_CODES = {
  XM: "YKMDC",
  EXNESS: "00awo0516g",
} as const;

export interface BrokerTransferGuideItem {
  broker: Broker;
  label: string;
  partnerCode: string;
  tag?: string;
  steps: readonly string[];
  note?: string;
}

export interface BrokerTransferGuideSpec {
  title: string;
  shortTitle: string;
  description: string;
  brokers: readonly BrokerTransferGuideItem[];
  supportNote: string;
  image: {
    src: string;
    fallbackSrc: string;
    width: number;
    height: number;
    sizes: string;
    alt: string;
  };
}

export const BROKER_TRANSFER_GUIDE: BrokerTransferGuideSpec = {
  title: "มีบัญชีเทรดอยู่แล้ว? วิธีย้ายสายงาน / บัญชีเพิ่มเติม",
  shortTitle: "วิธีย้ายสายงาน (กรณีมีบัญชีอยู่แล้ว)",
  description: "สำหรับท่านที่มีบัญชีกับโบรกเกอร์อยู่แล้ว สามารถเปิดบัญชีเทรดเพิ่มเติมหรือแจ้งย้ายสายงานมาที่รหัสพันธมิตรของเราเพื่อรับสิทธิ์ใช้งานฟรีได้เช่นกัน",
  brokers: [
    {
      broker: "XM",
      label: "XM",
      partnerCode: BROKER_PARTNER_CODES.XM,
      tag: "แนะนำ",
      steps: [
        "เข้าสู่ระบบสมาชิก XM (Member Area)",
        "เลือกเมนู 'เปิดบัญชีเพิ่มเติม' (Additional Account)",
        `ในช่องรหัสพันธมิตร (Partner Code) ระบุ: ${BROKER_PARTNER_CODES.XM}`,
        `หรือติดต่อฝ่ายบริการลูกค้า (Live Chat) ของ XM และแจ้งขอย้ายสายงานมาที่รหัสพันธมิตร ${BROKER_PARTNER_CODES.XM}`,
      ],
      note: "เมื่อเปิดบัญชีเพิ่มเติมสำเร็จแล้ว นำเลขบัญชี MT4 / MT5 มายื่นขอรับสิทธิ์ในหน้าสมาชิกได้ทันที",
    },
    {
      broker: "EXNESS",
      label: "Exness",
      partnerCode: BROKER_PARTNER_CODES.EXNESS,
      steps: [
        "เข้าสู่พื้นที่ส่วนบุคคล Exness (Personal Area)",
        "ไปที่เมนู 'การตั้งค่า' หรือติดต่อฝ่ายสนับสนุนลูกค้า (Live Chat / Support)",
        `แจ้งเจ้าหน้าที่ขอย้ายสายงานพาร์ทเนอร์หรือเปลี่ยนผู้แนะนำ โดยระบุรหัสพาร์ทเนอร์: ${BROKER_PARTNER_CODES.EXNESS}`,
      ],
      note: "เมื่อระบบอนุมัติการย้ายพาร์ทเนอร์แล้ว นำเลขบัญชี MT4 / MT5 มายื่นขอรับสิทธิ์ได้ทันที",
    },
  ],
  supportNote: "หากต้องการสอบถามเพิ่มเติม หรือต้องการเทรดทั้ง 2 โบรกเกอร์ สามารถติดต่อแจ้งแอดมินเพื่อช่วยแนะนำได้ตลอดเวลา",
  image: {
    src: "/images/broker-ib/broker-transfer-guide.webp",
    fallbackSrc: "/images/broker-ib/broker-transfer-guide.jpg",
    width: 682,
    height: 1024,
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 450px",
    alt: "ตารางเปรียบเทียบโบรกเกอร์และรหัสพันธมิตรสำหรับการย้ายสายงาน XM และ Exness",
  },
};

/**
 * ข้อความของสิทธิ์ผ่าน IB (หน้าสมาชิก + หน้าเว็บสาธารณะ) — กติกา CLAUDE.md ข้อ 3: ห้ามรีวิว/สถิติ/ตัวเลขกำไร
 * {min} ถูกแทนด้วยยอดฝากขั้นต่ำจากการตั้งค่า
 */
export const BROKER_IB_CONTENT = {
  eyebrow: "ทางเลือกใช้งานฟรี",
  title: "ใช้ฟรีเมื่อเปิดบัญชีเทรด ผ่านลิงก์พาร์ทเนอร์",
  description: `เปิดบัญชีกับโบรกเกอร์พาร์ทเนอร์ผ่านลิงก์ของเรา ฝากเงินครั้งแรกครบขั้นต่ำ แล้วยื่นเลขบัญชีเทรด — ทีมงานตรวจสอบแล้วเปิดสิทธิ์ให้ ${BROKER_IB_PLAN.durationDays} วัน ต่ออายุได้เรื่อย ๆ`,
  steps: [
    { title: "เปิดบัญชีผ่านลิงก์ของเรา (หรือย้ายสายงาน)", detail: "กดลิงก์โบรกเกอร์ด้านล่างเพื่อสมัครใหม่ — หากมีบัญชีเดิมอยู่แล้ว สามารถเปิดบัญชีย่อยหรือแจ้งย้ายสายงานตามคู่มือได้" },
    { title: "ยืนยันตัวตน และฝากเงินครั้งแรกอย่างน้อย {min}", detail: "เงินฝากอยู่ในบัญชีเทรดของคุณกับโบรกเกอร์ ไม่ได้จ่ายให้เรา และถอนผ่านโบรกเกอร์ได้ตามเงื่อนไขของโบรกเกอร์" },
    { title: "ยื่นเลขบัญชี MT4 / MT5 ในหน้าสมาชิก", detail: "ใช้อีเมลเดียวกับที่สมัครกับโบรกเกอร์ — เราไม่ขอรหัสผ่านหรือ Investor Password ใด ๆ" },
    { title: "ทีมงานตรวจใน Partner Portal แล้วแจ้งผลทางอีเมล", detail: "อนุมัติแล้วทีมงานเปิดสิทธิ์อินดิเคเตอร์และช่องทางคอมมูนิตี้ให้เหมือนสมาชิกแบบชำระเงิน" },
    {
      title: `รับสิทธิ์ ${BROKER_IB_PLAN.durationDays} วัน ขอต่อได้เรื่อย ๆ`,
      detail: `ยื่นต่อได้ในช่วง ${BROKER_IB_RULES.renewalWindowDays} วันก่อนหมดอายุ ทีมงานตรวจบัญชีอีกครั้ง และวันใช้งานทบต่อเหมือนแพ็กเกจปกติ`,
    },
  ],
  risks: [
    "การเทรด Forex / CFD / ทองคำผ่านโบรกเกอร์มีความเสี่ยงสูงจากการใช้เลเวอเรจ อาจสูญเสียเงินลงทุนทั้งหมด — อย่าฝากเงินเพียงเพื่อรับสิทธิ์ใช้อินดิเคเตอร์",
    "XM และ Exness เป็นบริษัทภายนอก บัญชี เงินฝาก การถอน และข้อพิพาทเป็นไปตามข้อกำหนดของโบรกเกอร์ — ตรวจสอบใบอนุญาตและกฎหมายที่ใช้กับคุณก่อนเปิดบัญชี",
  ],
  disclosure: "เปิดเผยข้อมูล: เราได้รับค่าตอบแทนจากโบรกเกอร์เมื่อคุณเปิดบัญชีและเทรดผ่านลิงก์พาร์ทเนอร์ จึงให้สิทธิ์ใช้งานฟรีเป็นการตอบแทน",
  noPasswordNote: "เราจะไม่ขอรหัสผ่าน หรือ Investor Password ของบัญชีเทรดเด็ดขาด",
} as const;

/** แทน {min} ด้วยยอดฝากขั้นต่ำเป็นบาทของแต่ละโบรกเกอร์ เช่น "1,000 บาท (XM) หรือ 1,500 บาท (Exness)" */
export function fillMinDeposit(text: string, brokers: { label: string; minDepositThb: number }[]): string {
  const amounts = brokers.map((offer) => `${offer.minDepositThb.toLocaleString("th-TH", { maximumFractionDigits: 2 })} บาท (${offer.label})`);
  return text.replace("{min}", amounts.join(" หรือ "));
}

/** คำถามที่พบบ่อยของสิทธิ์ผ่าน IB (หน้า /broker-ib) */
export const BROKER_IB_FAQ = [
  {
    q: "ต้องจ่ายเงินให้เว็บไซต์ไหม",
    a: "ไม่ต้อง เงินฝากอยู่ในบัญชีเทรดของคุณกับโบรกเกอร์ และถอนผ่านโบรกเกอร์ได้ตามเงื่อนไขของโบรกเกอร์ — เราได้รับค่าตอบแทนจากโบรกเกอร์ตามโปรแกรมพาร์ทเนอร์ จึงให้สิทธิ์ใช้งานฟรี",
  },
  {
    q: "มีบัญชีกับโบรกเกอร์นี้อยู่แล้ว ใช้ได้ไหม",
    a: `ใช้ได้ โดยสามารถเปิดบัญชีเทรดเพิ่มเติมหรือแจ้งย้ายสายงานกับโบรกเกอร์ได้ทันที: XM ใส่รหัสพันธมิตร ${BROKER_PARTNER_CODES.XM} และ Exness ใส่รหัสพาร์ทเนอร์ ${BROKER_PARTNER_CODES.EXNESS} เมื่อบัญชีอยู่ภายใต้สายงานและฝากเงินครบขั้นต่ำแล้ว นำเลขบัญชีมายื่นรับสิทธิ์ได้ตามปกติ`,
  },
  {
    q: "ต้องให้รหัสผ่านบัญชีเทรดไหม",
    a: "ไม่ต้องและห้ามให้ใคร เราขอแค่เลขบัญชีเทรด (MT4/MT5 Login) และอีเมลที่ใช้สมัครกับโบรกเกอร์ เพื่อตรวจใน Partner Portal เท่านั้น",
  },
  {
    q: "สิทธิ์ผ่าน IB ต่างจากแพ็กเกจแบบชำระเงินอย่างไร",
    a: `ได้อินดิเคเตอร์และช่องทางคอมมูนิตี้เหมือนกัน แต่สิทธิ์ครั้งละ ${BROKER_IB_PLAN.durationDays} วัน ต้องยื่นต่อทุกครั้งที่หมด (ทีมงานตรวจบัญชีอีกครั้ง) และไม่มีการล็อกราคา — เลือกแพ็กเกจแบบชำระเงินแทนได้ทุกเมื่อ วันใช้งานทบต่อกัน`,
  },
  {
    q: "ถ้าย้ายบัญชีออกจากลิงก์พาร์ทเนอร์ หรือข้อมูลไม่ถูกต้อง",
    a: "ทีมงานอาจปิดสิทธิ์ผ่าน IB ก่อนกำหนด โดยไม่กระทบวันใช้งานของแพ็กเกจที่คุณชำระเงินไว้",
  },
] as const;
