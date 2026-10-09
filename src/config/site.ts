export const siteConfig = {
  name: "Peenoey Indicator",
  shortName: "Peenoey",
  description: "ระบบอินดิเคเตอร์ TradingView ระดับพรีเมียม สัญญาณแม่นยำ พร้อมคอมมูนิตี้และระบบแจ้งเตือนแบบเรียลไทม์",
  domain: process.env.NEXT_PUBLIC_SITE_DOMAIN || "peenoey.com",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  adminEmail: process.env.ADMIN_EMAIL || "admin@peenoey.com",
  supportTelegram: process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM || "https://t.me/peenoey_support",
  ogImage: "/images/og-image.png",
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
