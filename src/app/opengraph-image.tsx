import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";
import { IMAGE_SLOTS } from "@/config/marketing";

// ใช้ edge runtime: @vercel/og แบบ Node ใน Next 14 แปลง path ผิดบน Windows (Invalid URL ตอน build)
export const runtime = "edge";
export const alt = `${siteConfig.name} — TradingView Invite-only Indicator`;
export const size = { width: IMAGE_SLOTS.ogImage.width, height: IMAGE_SLOTS.ogImage.height };
export const contentType = "image/png";

/**
 * OG Image ชั่วคราว (สร้างอัตโนมัติ) — ใช้ข้อความภาษาอังกฤษเพราะฟอนต์เริ่มต้นของ ImageResponse ไม่มีอักษรไทย
 * เมื่อได้ภาพจริงขนาด 1200×630 ให้แทนที่ไฟล์นี้ด้วย src/app/opengraph-image.png
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #0B0F17 0%, #111827 60%, #2A1F0A 100%)",
          color: "#F3F4F6",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "18px",
              background: "linear-gradient(135deg, #FBBF24, #D97706)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "40px",
              fontWeight: 700,
              color: "#000",
            }}
          >
            P
          </div>
          <div style={{ fontSize: "40px", fontWeight: 700 }}>{siteConfig.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ fontSize: "64px", fontWeight: 700, color: "#FBBF24", lineHeight: 1.1 }}>
            TradingView Invite-only Indicator
          </div>
          <div style={{ fontSize: "32px", color: "#D1D5DB" }}>Telegram VIP alerts · Discord community · PromptPay checkout</div>
        </div>
        <div style={{ fontSize: "24px", color: "#9CA3AF" }}>{siteConfig.domain}</div>
      </div>
    ),
    size,
  );
}
