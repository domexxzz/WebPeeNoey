/**
 * Content-Security-Policy แบบเข้มงวดสำหรับหลังบ้าน (CLAUDE.md ข้อ 4)
 * - script ต้องมี nonce ที่สุ่มใหม่ทุกคำขอ (Next.js ใส่ nonce ให้ script ของตัวเองอัตโนมัติ)
 * - style ต้องเปิด 'unsafe-inline' เพราะ next/font และ Next.js ใส่ <style> แบบ inline
 * ใช้ได้ทั้งใน Edge (middleware) และ Node
 */
export function buildAdminCsp(nonce: string, isDevelopment: boolean): string {
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDevelopment ? ["'unsafe-eval'"] : [])].join(" ");
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...Array.from(bytes)));
}
