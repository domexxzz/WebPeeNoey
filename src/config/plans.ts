export interface PlanConfig {
  id: string;
  slug: string;
  name: string;
  durationDays: number;
  durationLabel: string;
  price: number;
  originalPrice: number;
  isPromo: boolean;
  promoLimit?: number;
  lockPriceForLife: boolean;
  popular?: boolean;
  badge?: string;
  features: string[];
  description: string;
}

export const SITE_PLANS: PlanConfig[] = [
  {
    id: "plan_1m",
    slug: "monthly",
    name: "แพ็กเกจ 1 เดือน",
    durationDays: 30,
    durationLabel: "30 วัน",
    price: 990,
    originalPrice: 1490,
    isPromo: true,
    promoLimit: 300,
    lockPriceForLife: true,
    badge: "เริ่มต้นทดลอง",
    description: "เหมาะสำหรับนักเทรดที่ต้องการทดลองใช้งานสัญญาณอินดิเคเตอร์อย่างเต็มรูปแบบ",
    features: [
      "สิทธิ์ใช้ Indicator TradingView แบบ Invite-only (Full Features)",
      "สิทธิ์เข้ากลุ่ม Telegram VIP สัญญาณเรียลไทม์",
      "ยศ VIP ใน Discord คอมมูนิตี้",
      "วิดีโอคู่มือสอนการตั้งค่าและกลยุทธ์ทีละขั้นตอน",
      "ระบบช่วยเหลือและ Support ทางเทคนิค",
      "ล็อกราคาพิเศษนี้ตลอดอายุการต่ออายุ"
    ]
  },
  {
    id: "plan_3m",
    slug: "quarterly",
    name: "แพ็กเกจ 3 เดือน",
    durationDays: 90,
    durationLabel: "90 วัน",
    price: 2490,
    originalPrice: 3990,
    isPromo: true,
    promoLimit: 300,
    lockPriceForLife: true,
    badge: "ประหยัด 37%",
    description: "ระยะเวลาที่แนะนำสำหรับการทดสอบกลยุทธ์และสร้างผลตอบแทนที่สม่ำเสมอ",
    features: [
      "ทุกอย่างในแพ็กเกจ 1 เดือน",
      "เฉลี่ยเพียง 830 บาท / เดือน (ประหยัดขึ้น)",
      "สิทธิ์เข้าร่วม Live Session ถาม-ตอบกลยุทธ์",
      "อัปเดตอัลกอริทึมเวอร์ชันใหม่ฟรีก่อนใคร",
      "ล็อกราคาพิเศษนี้ตลอดอายุการต่ออายุ"
    ]
  },
  {
    id: "plan_6m",
    slug: "biannual",
    name: "แพ็กเกจ 6 เดือน",
    durationDays: 180,
    durationLabel: "180 วัน",
    price: 4490,
    originalPrice: 6990,
    isPromo: true,
    promoLimit: 300,
    lockPriceForLife: true,
    popular: true,
    badge: "ยอดนิยมสูงสุด 🔥",
    description: "ตัวเลือกยอดนิยมสำหรับนักเทรดสาย Full-time และ Swing Trader",
    features: [
      "ทุกอย่างในแพ็กเกจ 3 เดือน",
      "เฉลี่ยเพียง 748 บาท / เดือน (สุดคุ้ม)",
      "Template และ Dashboard วิเคราะห์ความเสี่ยง Portfolio",
      "Priority VIP Support ตอบกลับภายใน 15 นาที",
      "ล็อกราคาพิเศษนี้ตลอดอายุการต่ออายุ"
    ]
  },
  {
    id: "plan_12m",
    slug: "annual",
    name: "แพ็กเกจ 1 ปี (12 เดือน)",
    durationDays: 365,
    durationLabel: "365 วัน",
    price: 7990,
    originalPrice: 12990,
    isPromo: true,
    promoLimit: 300,
    lockPriceForLife: true,
    badge: "คุ้มค่าที่สุด ⭐",
    description: "สำหรับนักเทรดจริงจังที่ต้องการระบบเทรดระดับมืออาชีพตลอดทั้งปี",
    features: [
      "ทุกอย่างในแพ็กเกจ 6 เดือน",
      "เฉลี่ยเพียง 665 บาท / เดือน (ประหยัดสูงสุด 5,000 บาท)",
      "สิทธิ์เข้าถึง Private Strategy Backtest Vault ทั้งหมด",
      "สิทธิ์ได้รับอินดิเคเตอร์ตัวใหม่ในอนาคตฟรีตลอด 1 ปี",
      "ล็อกราคาพิเศษนี้ตลอดอายุการต่ออายุ"
    ]
  }
];

export const PROMO_SETTINGS = {
  maxEarlyBirdUsers: 300,
  promoTitle: "ข้อเสนอพิเศษ Early Bird 300 ท่านแรก",
  promoSubtitle: "รับสิทธิ์ราคาพิเศษทันที พร้อมสิทธิ์ล็อกราคาเดิมนี้ตลอดอายุการต่ออายุสัญญา",
};

export function getPlanBySlug(slug: string): PlanConfig | undefined {
  return SITE_PLANS.find((plan) => plan.slug === slug);
}

export function getPlanById(id: string): PlanConfig | undefined {
  return SITE_PLANS.find((plan) => plan.id === id);
}

export function formatTHB(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
