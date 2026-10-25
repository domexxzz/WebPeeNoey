import { formatDateTime } from "@/lib/format";
import { maskEmail } from "@/lib/broker-ib/validation";

/**
 * แจ้งกลุ่มแอดมินเมื่อมีสมาชิกใหม่ — อีเมลแบบซ่อน, ชื่อผู้ใช้ TradingView (ตรวจรูปแบบแล้วตอนสมัคร) และลิงก์หน้าสมาชิก
 * ไม่ใส่ชื่อที่สมาชิกพิมพ์เอง (ข้อความอิสระ — ปลอมบรรทัดในข้อความแอดมินได้) และไม่มีรหัสผ่าน/ข้อมูลอื่น
 */
export function buildNewMemberMessage(
  member: { id: string; email: string; tradingViewUsername: string | null; createdAt: Date },
  siteUrl: string,
): string {
  return [
    "👤 สมาชิกใหม่สมัครเข้าระบบ",
    `อีเมล: ${maskEmail(member.email)}`,
    `TradingView: ${member.tradingViewUsername ?? "ยังไม่ได้กรอก"}`,
    `เวลา: ${formatDateTime(member.createdAt)}`,
    `ดูสมาชิก: ${siteUrl}/admin/members/${member.id}`,
  ].join("\n");
}
