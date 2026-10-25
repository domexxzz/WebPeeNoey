import type { CSSProperties } from "react";
import Image from "next/image";
import { IMAGE_SLOTS } from "@/config/marketing";
import { indexStyle } from "@/lib/motion";
import { ChartDecoration } from "./chart-decoration";

type PhotoEffect = "chart" | "chat" | "channels";

/**
 * ภาพหน้าจอจริงจากเจ้าของ (ตัดแล้ว): กราฟตัดตาราง Win Rate/สถิติออก, แชตเหลือเฉพาะข้อความสัญญาณ + เบลอชื่อสมาชิก,
 * Discord = ห้องสัญญาณจริง เลือกเฉพาะการ์ดที่เป็น "แผนเทรด" (เข้า/SL/TP) ไม่เอาการ์ดผลลัพธ์ที่มีตัวเลขกำไร-ขาดทุน
 * และตัดรายชื่อ/จำนวนสมาชิกออก
 * ห้ามใส่ภาพที่มีกำไร/สถิติผลงาน หรือชื่อ/รูปของสมาชิกคนอื่น (CLAUDE.md ข้อ 3)
 * backdrop = สีพื้นของภาพ (เห็นระหว่างที่ภาพเลื่อนเข้า)
 */
const FEATURE_PHOTOS: Record<string, { src: string; alt: string; effect: PhotoEffect; backdrop: string }> = {
  indicator: {
    src: "/images/features/indicator-chart.webp",
    alt: "กราฟทองคำ 5 นาทีบน TradingView ที่เปิดอินดิเคเตอร์ Gold HybridShot Signals แสดงจุด SELL พร้อมเส้น TP1, TP2 และ SL",
    effect: "chart",
    backdrop: "bg-[#0f0f0f]",
  },
  telegram: {
    src: "/images/features/discord-signals.webp",
    alt: "ห้องสัญญาณของเรา แสดงสัญญาณ SELL และ BUY ของทองคำ พร้อมราคาเข้า จุดตัดขาดทุน และเป้าหมาย TP1, TP2",
    effect: "chat",
    backdrop: "bg-[#1e1f22]",
  },
  discord: {
    src: "/images/features/discord-channels.webp",
    alt: "เซิร์ฟเวอร์ Discord Noble Gold Society แสดงห้องการใช้เครื่องมือ, e-book, คลิปเรียนย้อนหลัง และไลฟ์เทรดสด",
    effect: "channels",
    backdrop: "bg-[#1e1f22]",
  },
};

/** ตำแหน่งป้าย SELL, TP1, TP2, SL ในภาพกราฟ (% ของภาพ 1200×750) — กระพริบตามลำดับนี้ */
const CHART_MARKERS = [
  { x: 66.7, y: 34.9 },
  { x: 91.6, y: 61.5 },
  { x: 91.6, y: 74.3 },
  { x: 91.1, y: 5.5 },
];

function markerStyle(index: number, x: number, y: number): CSSProperties {
  return { ...indexStyle(index), left: `${x}%`, top: `${y}%` };
}

/** ชั้นอนิเมชันซ้อนบนภาพ (ตกแต่งเท่านั้น — ซ่อนจากโปรแกรมอ่านหน้าจอ) */
function PhotoOverlay({ effect }: { effect: PhotoEffect }) {
  if (effect === "chart") {
    return (
      <>
        <span className="fa-wipe" aria-hidden="true" />
        {CHART_MARKERS.map((marker, index) => (
          <span key={index} className="fa-pulse" aria-hidden="true" style={markerStyle(index, marker.x, marker.y)} />
        ))}
      </>
    );
  }
  if (effect === "chat") {
    return (
      <span className="fa-typing" aria-hidden="true">
        {[0, 1, 2].map((dot) => (
          <i key={dot} className="fa-dot" style={indexStyle(dot)} />
        ))}
      </span>
    );
  }
  return <span className="fa-scan" aria-hidden="true" />;
}

/**
 * ภาพประกอบของแต่ละฟีเจอร์: ภาพหน้าจอจริง (FEATURE_PHOTOS) หรือกราฟวาดเองสำหรับฟีเจอร์ที่ยังไม่มีภาพ
 * อนิเมชัน (src/styles/motion-art.css): ภาพเด้งเข้า (.fa-pop) แล้วแต่ละภาพมีลูกเล่นของตัวเอง —
 * กราฟเผยจากซ้ายไปขวา + ป้าย BUY/TP/SL กระพริบทีละจุด, แชตขึ้น "กำลังพิมพ์" แล้วข้อความเลื่อนขึ้น,
 * Discord มีแถบไฮไลต์ไล่ตามห้อง — ชี้แล้วมีแสงวิ้งผ่านภาพ (.mx-shine)
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
    <div className="fa-pop fa-center">
      <div className={`fa-photo mx-shine ${photo.backdrop}`}>
        <div className={photo.effect === "chat" ? "fa-slide" : undefined}>
          <Image
            src={photo.src}
            alt={photo.alt}
            width={width}
            height={height}
            sizes={sizes}
            className="block w-full h-auto transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        </div>
        <PhotoOverlay effect={photo.effect} />
      </div>
    </div>
  );
}
