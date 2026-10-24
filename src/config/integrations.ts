/**
 * บริการภายนอกด้าน SEO / สถิติ ที่ตั้งผ่าน env (ค่าสาธารณะ ไม่ใช่ความลับ) — ไม่ตั้ง/รูปแบบผิด = ปิดไว้
 * ค่า NEXT_PUBLIC_* ถูกฝังตอน build: แก้ใน Render แล้วต้อง deploy ใหม่
 */

export interface Integrations {
  /** ค่า content ของ <meta name="google-site-verification"> จาก Google Search Console */
  googleSiteVerification: string | null;
  /** ค่า content ของ <meta name="msvalidate.01"> จาก Bing Webmaster Tools */
  bingSiteVerification: string | null;
  /** token ของ Cloudflare Web Analytics (ไม่ใช้คุกกี้ — ไม่ต้องขอความยินยอมตามนโยบายความเป็นส่วนตัวข้อ 8) */
  cloudflareAnalyticsToken: string | null;
}

interface IntegrationsEnv {
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?: string;
  NEXT_PUBLIC_BING_SITE_VERIFICATION?: string;
  NEXT_PUBLIC_CF_ANALYTICS_TOKEN?: string;
}

const VERIFICATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{10,100}$/;
const CLOUDFLARE_TOKEN_PATTERN = /^[a-f0-9]{32}$/;

export function normalizeVerificationToken(raw: string | undefined | null): string | null {
  const value = raw?.trim() ?? "";
  return VERIFICATION_TOKEN_PATTERN.test(value) ? value : null;
}

export function normalizeCloudflareAnalyticsToken(raw: string | undefined | null): string | null {
  const value = raw?.trim().toLowerCase() ?? "";
  return CLOUDFLARE_TOKEN_PATTERN.test(value) ? value : null;
}

export function resolveIntegrations(env: IntegrationsEnv): Integrations {
  return {
    googleSiteVerification: normalizeVerificationToken(env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION),
    bingSiteVerification: normalizeVerificationToken(env.NEXT_PUBLIC_BING_SITE_VERIFICATION),
    cloudflareAnalyticsToken: normalizeCloudflareAnalyticsToken(env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN),
  };
}

/** รูปแบบ metadata.verification ของ Next.js — ไม่มี token เลย = undefined (ไม่ใส่แท็ก) */
export function buildVerificationMetadata(
  integrations: Pick<Integrations, "googleSiteVerification" | "bingSiteVerification">,
): { google?: string; other?: Record<string, string> } | undefined {
  const { googleSiteVerification: google, bingSiteVerification: bing } = integrations;
  if (!google && !bing) return undefined;
  return {
    ...(google ? { google } : {}),
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  };
}

/** ข้อความเปิดเผยการเก็บสถิติในนโยบายความเป็นส่วนตัว — แสดงเฉพาะเมื่อเปิดใช้ */
export function analyticsDisclosure(enabled: boolean): string | null {
  if (!enabled) return null;
  return "เว็บไซต์ใช้ Cloudflare Web Analytics นับจำนวนผู้เข้าชม หน้าที่เปิด แหล่งที่มา และประเภทอุปกรณ์แบบภาพรวม บริการนี้ไม่ใช้คุกกี้และไม่ติดตามผู้ใช้ข้ามเว็บไซต์ ข้อมูลถูกประมวลผลตามนโยบายความเป็นส่วนตัวของ Cloudflare (https://www.cloudflare.com/privacypolicy/)";
}

// NEXT_PUBLIC_* ต้องอ้างชื่อเต็มตรง ๆ ให้ Next.js ฝังค่าตอน build
export const INTEGRATIONS: Integrations = resolveIntegrations({
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  NEXT_PUBLIC_BING_SITE_VERIFICATION: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION,
  NEXT_PUBLIC_CF_ANALYTICS_TOKEN: process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN,
});
