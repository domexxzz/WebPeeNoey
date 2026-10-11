import { FEATURES, type FeatureItem } from "@/config/marketing";

export interface FeatureDetail {
  feature: FeatureItem;
  bullets: string[];
  imageAlt: string;
}

const DETAILS: Record<string, Omit<FeatureDetail, "feature">> = {
  indicator: {
    bullets: [
      "เปิดสิทธิ์ให้ตาม TradingView Username ที่ลงทะเบียนไว้ ไม่ต้องติดตั้งโปรแกรมเพิ่ม",
      "ใช้งานได้ทุกอุปกรณ์ที่ล็อกอิน TradingView บัญชีเดียวกัน ทั้งเว็บ แอปมือถือ และเดสก์ท็อป",
      "เมื่อสิทธิ์หมดอายุ ระบบปิดสิทธิ์อัตโนมัติ และเปิดใหม่ทันทีหลังต่ออายุได้รับอนุมัติ",
    ],
    imageAlt: "ภาพหน้าจออินดิเคเตอร์บนกราฟ TradingView",
  },
  telegram: {
    bullets: [
      "รับลิงก์เชิญเข้ากลุ่มแบบใช้ครั้งเดียวหลังคำสั่งซื้อได้รับอนุมัติ",
      "ติดตามการแจ้งเตือนและประกาศสำคัญจากทีมงานได้บนมือถือ",
      "สิทธิ์ในกลุ่มผูกกับอายุสมาชิก และถูกปิดเมื่อหมดอายุ",
    ],
    imageAlt: "ภาพตัวอย่างหน้ากลุ่ม Telegram VIP",
  },
  discord: {
    bullets: [
      "รับยศ VIP ตาม Discord User ID ที่คุณแจ้งกับทีมงาน",
      "เข้าห้องสนทนาเฉพาะสมาชิกเพื่อแลกเปลี่ยนวิธีใช้งาน",
      "ยศถูกถอดอัตโนมัติเมื่อสิทธิ์หมดอายุ",
    ],
    imageAlt: "ภาพตัวอย่างห้องสมาชิกใน Discord",
  },
  guides: {
    bullets: [
      "คู่มือทีละขั้นตอนตั้งแต่สมัครจนถึงเพิ่มอินดิเคเตอร์ลงกราฟ",
      "วิดีโอสอนการตั้งค่าสำหรับสมาชิก",
      "อัปเดตคู่มือเมื่อมีการปรับปรุงเวอร์ชันอินดิเคเตอร์",
    ],
    imageAlt: "ภาพตัวอย่างหน้าคู่มือและวิดีโอสอน",
  },
};

/** ดึงรายละเอียดเฉพาะฟีเจอร์ที่มีข้อมูลเชิงลึก โดยใช้ชื่อและคำอธิบายจาก FEATURES (แหล่งเดียว) */
export const FEATURE_DETAILS: FeatureDetail[] = FEATURES.filter((feature) => feature.id in DETAILS).map((feature) => ({
  feature,
  ...DETAILS[feature.id],
}));
