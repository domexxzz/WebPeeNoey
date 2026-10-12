/** ข้อความแจ้งกลุ่มแอดมินเมื่อมีสลิปใหม่ — ใช้ทั้งตอนลูกค้าแนบสลิปและตอน Watchdog ส่งซ้ำ */
export function buildNewSlipMessage(
  slip: { orderId: string; orderNumber: string; planName: string; amount: number },
  siteUrl: string,
  { retry = false }: { retry?: boolean } = {},
): string {
  return [
    retry ? "🧾 สลิปรอตรวจสอบ (ส่งซ้ำ — ครั้งก่อนแจ้งไม่สำเร็จ)" : "🧾 สลิปใหม่รอตรวจสอบ",
    `ออเดอร์: ${slip.orderNumber}`,
    `แพ็กเกจ: ${slip.planName}`,
    `ยอดที่ต้องได้รับ: ${slip.amount.toFixed(2)} บาท`,
    `ตรวจสอบ: ${siteUrl}/admin/orders/${slip.orderId}`,
  ].join("\n");
}
