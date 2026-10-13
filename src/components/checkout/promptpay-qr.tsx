import QRCode from "qrcode";

/**
 * แสดง PromptPay QR เป็น SVG ที่สร้างฝั่ง server จาก payload ของเราเอง (ไม่มีข้อมูลจากผู้ใช้ปนใน SVG)
 * ไม่ใช้ next/image เพราะเป็น SVG ที่สร้างสดต่อคำสั่งซื้อ ไม่ใช่ไฟล์ภาพ
 */
export async function PromptPayQr({ payload, label }: { payload: string; label: string }) {
  const svg = await QRCode.toString(payload, { type: "svg", errorCorrectionLevel: "M", margin: 2, width: 280 });
  // กรอบมุมแบบช่องมองกล้อง (.mx-qr) อยู่รอบนอก QR เท่านั้น — ไม่ทับโมดูลของ QR
  return (
    <div className="mx-qr mx-auto w-full max-w-[280px]">
      <div
        role="img"
        aria-label={label}
        className="w-full overflow-hidden rounded-xl bg-white p-2 [&>svg]:h-auto [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
