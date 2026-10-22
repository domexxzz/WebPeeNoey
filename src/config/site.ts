const LOCAL_SITE_URL = "http://localhost:3000";

interface SiteUrlEnv {
  VERCEL_ENV?: string;
  RENDER?: string;
  IS_PULL_REQUEST?: string;
  NEXT_PUBLIC_APP_URL?: string;
}

/** Production จริงบนโฮสต์ที่ใช้: Vercel (VERCEL_ENV) หรือ Render (RENDER=true ที่ไม่ใช่ preview ของ pull request) */
function isProductionHost(env: SiteUrlEnv): boolean {
  return env.VERCEL_ENV === "production" || (env.RENDER === "true" && env.IS_PULL_REQUEST !== "true");
}

/**
 * URL หลักของเว็บ ใช้ใน canonical, sitemap, robots, OG และ JSON-LD
 * บน Production ต้องตั้ง NEXT_PUBLIC_APP_URL เป็นโดเมนจริง มิฉะนั้นให้ build ล้มทันที
 * (กันการเผยแพร่ canonical เป็น localhost โดยไม่รู้ตัว)
 */
export function resolveSiteUrl(env: SiteUrlEnv): string {
  const configured = env.NEXT_PUBLIC_APP_URL?.trim();
  if (isProductionHost(env) && (!configured || /localhost|127\.0\.0\.1/.test(configured))) {
    throw new Error("NEXT_PUBLIC_APP_URL must be set to the public domain for production builds");
  }
  return configured || LOCAL_SITE_URL;
}

export interface ContactInfo {
  email: string | null;
  /** LINE Official Account ID รูปแบบ @id */
  line: string | null;
  /** Telegram username รูปแบบ @handle */
  telegram: string | null;
}

interface ContactEnv {
  NEXT_PUBLIC_CONTACT_EMAIL?: string;
  NEXT_PUBLIC_CONTACT_LINE?: string;
  NEXT_PUBLIC_CONTACT_TELEGRAM?: string;
}

const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const LINE_ID_PATTERN = /^@?([a-z0-9._-]{3,20})$/;
// username ของ Telegram 5–32 ตัว (a-z 0-9 _) — ลิงก์เชิญกลุ่ม (t.me/+…, joinchat) ไม่ใช่ช่องทางติดต่อ
const TELEGRAM_PATTERN = /^(?:https:\/\/t\.me\/|@)?([A-Za-z][A-Za-z0-9_]{4,31})\/?$/;

export function normalizeContactEmail(raw: string | undefined | null): string | null {
  const value = raw?.trim().toLowerCase() ?? "";
  return EMAIL_PATTERN.test(value) ? value : null;
}

export function normalizeLineId(raw: string | undefined | null): string | null {
  const match = LINE_ID_PATTERN.exec(raw?.trim().toLowerCase() ?? "");
  return match ? `@${match[1]}` : null;
}

export function normalizeTelegramHandle(raw: string | undefined | null): string | null {
  const match = TELEGRAM_PATTERN.exec(raw?.trim() ?? "");
  return match ? `@${match[1]}` : null;
}

/**
 * ช่องทางติดต่อลูกค้าจาก env — ไม่ตั้ง/รูปแบบผิด = null แล้วซ่อนช่องทางนั้น
 * (ไม่มีค่าเริ่มต้น: บัญชี peenoey เดิมไม่มีอยู่จริง แสดงไว้ลูกค้าจะติดต่อไม่ได้)
 */
export function resolveContact(env: ContactEnv): ContactInfo {
  return {
    email: normalizeContactEmail(env.NEXT_PUBLIC_CONTACT_EMAIL),
    line: normalizeLineId(env.NEXT_PUBLIC_CONTACT_LINE),
    telegram: normalizeTelegramHandle(env.NEXT_PUBLIC_CONTACT_TELEGRAM),
  };
}

/** ข้อความช่องทางติดต่อในเอกสารกฎหมาย — แสดงเฉพาะช่องทางที่ตั้งไว้ */
export function formatContactLine(contact: ContactInfo): string {
  const parts = [
    contact.email && `อีเมล ${contact.email}`,
    contact.line && `LINE ${contact.line}`,
    contact.telegram && `Telegram ${contact.telegram}`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "ยังไม่ได้ระบุช่องทางติดต่อ — ผู้ให้บริการจะประกาศบนเว็บไซต์ก่อนเปิดรับชำระเงิน";
}

export const siteConfig = {
  // ชื่อแบรนด์ตามอินดิเคเตอร์ที่สมาชิกได้รับ (บน TradingView ชื่อ Gold HybridShot Signals) — เจ้าของเลือกตัวพิมพ์ "Gold Hybridshot"
  name: "Gold Hybridshot",
  shortName: "Gold Hybridshot",
  description:
    "อินดิเคเตอร์ TradingView แบบ Invite-only พร้อมกลุ่ม Telegram VIP สำหรับแจ้งเตือน และคอมมูนิตี้ Discord ชำระง่ายผ่าน PromptPay",
  domain: process.env.NEXT_PUBLIC_SITE_DOMAIN || "peenoey.com",
  url: resolveSiteUrl({
    VERCEL_ENV: process.env.VERCEL_ENV,
    RENDER: process.env.RENDER,
    IS_PULL_REQUEST: process.env.IS_PULL_REQUEST,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  }),
  adminEmail: process.env.ADMIN_EMAIL || "admin@peenoey.com",
  supportTelegram: process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM || "https://t.me/peenoey_support",
  /** ภาพแชร์โซเชียล 1200×630 สร้างจาก src/app/opengraph-image.tsx */
  ogImage: "/opengraph-image",
  links: {
    guide: "/guide",
    features: "/features",
    pricing: "/#pricing",
    terms: "/terms",
    privacy: "/privacy",
    refund: "/refund",
  },
  // NEXT_PUBLIC_* ต้องอ้างชื่อเต็มตรง ๆ ให้ Next.js ฝังค่าตอน build
  contact: resolveContact({
    NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
    NEXT_PUBLIC_CONTACT_LINE: process.env.NEXT_PUBLIC_CONTACT_LINE,
    NEXT_PUBLIC_CONTACT_TELEGRAM: process.env.NEXT_PUBLIC_CONTACT_TELEGRAM,
  }),
};
