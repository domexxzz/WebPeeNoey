/**
 * ลิงก์ช่วยเปิดสิทธิ์อินดิเคเตอร์บน TradingView (ไม่มี API ทางการ — แอดมินต้องเพิ่มชื่อผู้ใช้เองในหน้าสคริปต์)
 *
 * ทำไมต้องมี: ปุ่มในหลังบ้านเป็นแค่ "บันทึกว่าเปิดแล้ว" ไม่ได้ไปเพิ่มสิทธิ์ให้จริง
 * 30 ต.ค. 2569 พบว่าสมาชิก 2 คนถูกติ๊กว่าเปิดสิทธิ์แล้ว แต่ในรายการ Invite-only ของสคริปต์ไม่มีชื่อทั้งคู่
 */

/** ชื่อผู้ใช้ TradingView: ตัวอักษรอังกฤษ ตัวเลข และ _ เท่านั้น */
const USERNAME_PATTERN = /^[A-Za-z0-9_]{2,30}$/;

/** ลิงก์โปรไฟล์ไว้กดตรวจว่าชื่อผู้ใช้มีจริงก่อนเปิดสิทธิ์ — ชื่อที่ผิดรูปแบบคืน null (ห้ามเอาค่าดิบไปต่อใน href) */
export function tradingViewProfileUrl(username: string | null | undefined): string | null {
  const name = username?.trim() ?? "";
  return USERNAME_PATTERN.test(name) ? `https://www.tradingview.com/u/${name}/` : null;
}

/** หน้าสคริปต์ของเราเอง (ไว้กดเข้าไปที่ "จัดการการเข้าถึง") — รับเฉพาะ https ของ tradingview.com และต้องเป็นเส้นทาง /script/ */
export function resolveScriptAccessUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isTradingView = host === "tradingview.com" || host.endsWith(".tradingview.com");
    if (url.protocol !== "https:" || !isTradingView || !url.pathname.startsWith("/script/")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

// NEXT_PUBLIC_* ต้องอ้างชื่อเต็มตรง ๆ ให้ Next.js ฝังค่าตอน build
export const TRADINGVIEW_SCRIPT_ACCESS_URL = resolveScriptAccessUrl(process.env.NEXT_PUBLIC_TRADINGVIEW_SCRIPT_URL);
