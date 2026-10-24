import type { SlipCheckStatus } from "@/lib/payments/easyslip";
import type { QrIntegrity } from "@/lib/payments/slip-qr-payload";

/** ป้ายผลตรวจสลิปอัตโนมัติ — ใช้ทั้งใน Telegram และหน้าแอดมิน */
export const SLIP_CHECK_LABELS: Record<SlipCheckStatus, string> = {
  DISABLED: "ไม่ได้ตรวจกับธนาคาร",
  PENDING: "รอตรวจซ้ำ",
  VERIFIED: "ธนาคารยืนยันแล้ว",
  AMOUNT_MISMATCH: "ยอดไม่ตรง",
  WRONG_RECEIVER: "บัญชีผู้รับไม่ตรง",
  RECEIVER_UNVERIFIED: "ยืนยันผู้รับไม่ได้",
  STALE: "สลิปเก่ากว่าออเดอร์",
  UNREADABLE: "ธนาคารหาสลิปไม่เจอ",
  ERROR: "ตรวจอัตโนมัติไม่ได้",
  DUPLICATE: "เลขอ้างอิงซ้ำ",
};

export const QR_INTEGRITY_LABELS: Record<QrIntegrity, string> = {
  VALID: "QR รูปแบบถูกต้อง (checksum ตรง — ยังไม่ใช่การยืนยันจากธนาคาร)",
  INVALID: "QR checksum ไม่ตรง — น่าสงสัยว่าถูกแก้",
  ABSENT: "QR ไม่มี checksum",
};

const CHECK_ICONS: Partial<Record<SlipCheckStatus, string>> = { VERIFIED: "✅", PENDING: "⏳", DISABLED: "ℹ️" };

export interface SlipCheckSummary {
  status: SlipCheckStatus;
  note: string;
  qrIntegrity: QrIntegrity | null;
}

/** บรรทัดสรุปผลตรวจ — ผลที่ไม่ผ่านขึ้น ⚠️ ให้แอดมินดูละเอียดก่อนอนุมัติ */
export function formatSlipCheckLines(summary: SlipCheckSummary): string[] {
  const icon = CHECK_ICONS[summary.status] ?? "⚠️";
  const qr = summary.qrIntegrity ? QR_INTEGRITY_LABELS[summary.qrIntegrity] : "อ่าน QR ในสลิปไม่ได้";
  return [`${icon} ตรวจสลิป: ${SLIP_CHECK_LABELS[summary.status]} — ${summary.note}`, `${summary.qrIntegrity === "INVALID" ? "⚠️" : "🔎"} ${qr}`];
}

/** ข้อความแจ้งกลุ่มแอดมินเมื่อมีสลิปใหม่ — ใช้ทั้งตอนลูกค้าแนบสลิปและตอน Watchdog ส่งซ้ำ */
export function buildNewSlipMessage(
  slip: { orderId: string; orderNumber: string; planName: string; amount: number },
  siteUrl: string,
  { retry = false, check }: { retry?: boolean; check?: SlipCheckSummary } = {},
): string {
  return [
    retry ? "🧾 สลิปรอตรวจสอบ (ส่งซ้ำ — ครั้งก่อนแจ้งไม่สำเร็จ)" : "🧾 สลิปใหม่รอตรวจสอบ",
    `ออเดอร์: ${slip.orderNumber}`,
    `แพ็กเกจ: ${slip.planName}`,
    `ยอดที่ต้องได้รับ: ${slip.amount.toFixed(2)} บาท`,
    ...(check ? formatSlipCheckLines(check) : []),
    `ตรวจสอบ: ${siteUrl}/admin/orders/${slip.orderId}`,
  ].join("\n");
}
