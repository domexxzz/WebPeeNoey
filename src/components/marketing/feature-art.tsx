import Image from "next/image";
import { IMAGE_SLOTS } from "@/config/marketing";
import { ChartDecoration } from "./chart-decoration";

/**
 * ภาพหน้าจอจริงจากเจ้าของ (ตัดแล้ว): กราฟตัดตาราง Win Rate/สถิติออก, แชตเหลือเฉพาะข้อความสัญญาณ + เบลอชื่อสมาชิก,
 * Discord เหลือรายชื่อห้อง (ตัดรายชื่อ/จำนวนสมาชิกออก + เบลอตาราง Win Rate ในภาพคู่มือ)
 * ห้ามใส่ภาพที่มีกำไร/สถิติผลงาน หรือชื่อ/รูปของสมาชิกคนอื่น (CLAUDE.md ข้อ 3)
 */
const FEATURE_PHOTOS: Record<string, { src: string; alt: string }> = {
  indicator: {
    src: "/images/features/indicator-chart.webp",
    alt: "กราฟทองคำ 1 นาทีบน TradingView ที่เปิดอินดิเคเตอร์ Gold HybridShot Signals แสดงจุด BUY พร้อมเส้น TP1, TP2 และ SL",
  },
  telegram: {
    src: "/images/features/telegram-alert.webp",
    alt: "ข้อความสัญญาณจากบอท Gold Hybridshot ในกลุ่ม Telegram ระบุราคาเข้า, SL, TP1 และ TP2",
  },
  discord: {
    src: "/images/features/discord-channels.webp",
    alt: "เซิร์ฟเวอร์ Discord Noble Gold Society แสดงห้องการใช้เครื่องมือ, e-book, คลิปเรียนย้อนหลัง และไลฟ์เทรดสด",
  },
};

/**
 * ภาพประกอบของแต่ละฟีเจอร์: ภาพหน้าจอจริง (FEATURE_PHOTOS) หรือกราฟวาดเองสำหรับฟีเจอร์ที่ยังไม่มีภาพ
 * อนิเมชัน: ภาพ .fa-pop เด้งเมื่อแถวเลื่อนมาถึง ([data-reveal] ของแถว) — ดู src/styles/motion-art.css
 */
export function FeatureArt({ featureId }: { featureId: string }) {
  const photo = FEATURE_PHOTOS[featureId];
  if (!photo) {
    return (
      <div className="p-5">
        <ChartDecoration animated className="w-full h-40" />
      </div>
    );
  }
  const { width, height, sizes } = IMAGE_SLOTS.featureScreenshot;
  return (
    <div className="fa-pop fa-center overflow-hidden">
      <Image
        src={photo.src}
        alt={photo.alt}
        width={width}
        height={height}
        sizes={sizes}
        className="block w-full h-auto transition-transform duration-700 ease-out group-hover:scale-[1.03]"
      />
    </div>
  );
}
