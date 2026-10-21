import Image from "next/image";
import { IMAGE_SLOTS } from "@/config/marketing";
import { indexStyle } from "@/lib/motion";
import { ChartDecoration } from "./chart-decoration";

/**
 * ภาพประกอบของแต่ละฟีเจอร์: ภาพหน้าจอจริง (FEATURE_PHOTOS) หรือ SVG วาดเอง (ไม่มีตัวอักษร ตัวเลข หรือรายชื่อบุคคล)
 * อนิเมชัน: ชิ้น .fa-pop เด้งเมื่อแถวเลื่อนมาถึง ([data-reveal] ของแถว) — ดู src/styles/motion-art.css
 */
function CommunityArt() {
  const members = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 320 240" className="w-full h-auto">
      <rect x="20" y="20" width="76" height="200" rx="14" fill="rgba(31,26,18,0.05)" stroke="rgba(31,26,18,0.3)" />
      {[44, 70, 96, 122].map((y, index) => (
        <rect key={y} className="fa-pop" style={indexStyle(index)} x="32" y={y} width={index === 1 ? 52 : 40} height="7" rx="3.5" fill={index === 1 ? "#D4A537" : "rgba(31,26,18,0.25)"} />
      ))}
      {members.map((member) => {
        const column = member % 4;
        const row = Math.floor(member / 4);
        const cx = 140 + column * 46;
        const cy = 80 + row * 72;
        const highlighted = member === 2;
        return (
          <g key={member} className="fa-pop fa-center" style={indexStyle(member)}>
            {highlighted && <circle className="fa-ping" cx={cx} cy={cy} r="17" fill="none" stroke="#D4A537" strokeWidth="2" />}
            <circle cx={cx} cy={cy} r="17" fill={highlighted ? "#D4A537" : "rgba(31,26,18,0.1)"} stroke="rgba(31,26,18,0.45)" />
            <rect x={cx - 15} y={cy + 25} width="30" height="5" rx="2.5" fill="rgba(31,26,18,0.2)" />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * ภาพหน้าจอจริงจากเจ้าของ (ตัดแล้ว): กราฟตัดตาราง Win Rate/สถิติออก, แชตเหลือเฉพาะข้อความสัญญาณ + เบลอชื่อสมาชิก
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
};

export function FeatureArt({ featureId }: { featureId: string }) {
  const photo = FEATURE_PHOTOS[featureId];
  if (photo) {
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
  if (featureId === "discord") return <CommunityArt />;
  return (
    <div className="p-5">
      <ChartDecoration animated className="w-full h-40" />
    </div>
  );
}
