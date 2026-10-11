/**
 * Security Headers สำหรับทุกเส้นทาง (รวมหน้าสาธารณะที่ middleware ไม่ได้ครอบคลุม)
 * CSP ส่วนนี้คุมเฉพาะ directive ที่ไม่กระทบ script ของ Next.js
 * — script-src แบบ nonce จะทำแยกในงาน Hardening (ดู docs/HANDOFF.md)
 */
export const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
