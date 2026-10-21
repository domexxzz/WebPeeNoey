/**
 * middleware ต้องอ่านคุกกี้ session ชื่อเดียวกับที่ NextAuth ตั้ง: บน HTTPS = "__Secure-next-auth.session-token"
 * getToken() เดาเองจาก NEXTAUTH_URL แล้วถอยไปใช้ process.env.VERCEL — นอก Vercel (เช่น Render) จึงเดาเป็นคุกกี้ธรรมดา
 * ทำให้ล็อกอินสำเร็จแต่ middleware มองไม่เห็น session และเด้งกลับหน้าเข้าสู่ระบบตลอด
 * ค่า x-forwarded-proto ที่ผู้ใช้ปลอมมาแค่เปลี่ยนชื่อคุกกี้ที่อ่าน — token ยังต้องผ่านการตรวจด้วย secret เสมอ
 */
export function usesSecureSessionCookie(headers: Headers, requestUrl: string, env: { NEXTAUTH_URL?: string }): boolean {
  if (env.NEXTAUTH_URL?.startsWith("https://")) return true;
  if (headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https") return true;
  return requestUrl.startsWith("https://");
}
