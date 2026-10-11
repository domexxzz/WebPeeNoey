const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * Header สำหรับส่งไฟล์สลิป: แสดงในเบราว์เซอร์ (inline), ห้ามเดาชนิดไฟล์, ห้ามรันสคริปต์ใด ๆ (CSP sandbox)
 * และห้ามเก็บ cache ร่วม เพราะสลิปมีข้อมูลบัญชีธนาคารของลูกค้า
 * mimeType มาจากการตรวจ Magic Bytes ตอนอัปโหลด (ไม่ใช่ค่าที่ผู้ใช้ส่งมา)
 */
export function buildSlipResponseHeaders(slip: { id: string; mimeType: string; sizeBytes: number }): Record<string, string> {
  const extension = EXTENSIONS[slip.mimeType] ?? "bin";
  return {
    "Content-Type": slip.mimeType,
    "Content-Length": String(slip.sizeBytes),
    "Content-Disposition": `inline; filename="slip-${slip.id}.${extension}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
}
