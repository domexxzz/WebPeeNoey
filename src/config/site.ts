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

export const siteConfig = {
  // ชื่อแบรนด์ตามอินดิเคเตอร์ที่สมาชิกได้รับ (บน TradingView ชื่อ Gold HybridShot Signals) — เจ้าของเลือกตัวพิมพ์ "Gold Hybridshot" — โดเมน/ช่องทางติดต่อด้านล่างยังเป็นบัญชีเดิม
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
  contact: {
    email: "support@peenoey.com",
    line: "@peenoey",
    telegram: "@peenoey_admin",
  }
};
