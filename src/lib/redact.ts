/**
 * ลบข้อมูลอ่อนไหวออกจากข้อความผิดพลาดก่อน log / บันทึกลง JobRun / ส่งเข้า Telegram (CLAUDE.md ข้อ 4)
 * - connection string ของฐานข้อมูล (มีรหัสผ่าน), bot token ของ Telegram, อีเมล (ปิดบางส่วน)
 */
export function redactSensitive(text: string): string {
  return text
    .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, "postgresql://[redacted]")
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, "bot[redacted]")
    .replace(/\b([A-Za-z0-9._%+-]{1,2})[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g, "$1***@$2");
}
