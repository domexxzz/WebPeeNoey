const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

if (!webhookUrl) {
  console.error("Missing DISCORD_WEBHOOK_URL in environment");
  process.exit(1);
}

const payload = {
  username: "Peenoey System Monitor",
  avatar_url: "https://raw.githubusercontent.com/nextauthjs/next-auth/main/docs/static/img/logo/logo-sm.png",
  embeds: [
    {
      title: "🚀 รายงานสถานะโปรเจกต์: Peenoey Indicator (Phase 1 Complete)",
      description: "ระบบเว็บขายสมาชิกรายเดือน (Frontend + Backend + Back-office)\nปัจจุบันกำลังรัน Localhost พร้อมสถาปัตยกรรมระดับองค์กร",
      color: 16096779, // Amber Gold (#F59E0B)
      fields: [
        {
          name: "🌐 เซิร์ฟเวอร์ Localhost",
          value: "• **URL:** http://localhost:3000\n• **Status:** `Ready` (HTTP 200 OK ทุกเส้นทาง)\n• **Auth Routes:** `/auth/signin`, `/auth/signup`, `/auth/forgot-password`",
          inline: false,
        },
        {
          name: "✅ สิ่งที่ทำเสร็จแล้วใน Phase 0 & Phase 1",
          value: "1. **กติกาถาวร & แผนแม่บท:** บันทึก `CLAUDE.md`, `docs/PLAN.md`, `docs/HANDOFF.md`\n2. **Database Schema (Prisma):** 9 โมเดลหลัก (`User`, `Plan`, `Order`, `Payment`, `Subscription`, `Refund`, `AuditLog`, `RateLimit`, `SystemSetting`)\n3. **Central Pricing Config:** 4 แพ็กเกจใน `src/config/plans.ts` พร้อมล็อกราคา Early Bird 300 ท่าน\n4. **Security & Cryptography:** แฮชรหัสผ่าน bcrypt, SHA-256 ป้องกันสลิปซ้ำ, Rate Limiter ป้องกัน Brute-force\n5. **Role Separation:** แยก Layout ของ `/account` ออกจาก `/admin` เด็ดขาด\n6. **Security Headers:** บังคับใช้ `X-Frame-Options: DENY` กัน Clickjacking\n7. **Automated Tests & Build:** Vitest ผ่าน 10/10 เทสต์, Next.js Build ผ่าน 100%",
          inline: false,
        },
        {
          name: "📋 สิ่งที่ต้องทำต่อใน Phase 2 (หน้าบ้าน & SEO)",
          value: "1. **หน้า Landing Page ฉบับเต็ม:** Hero, จุดเด่นฟีเจอร์, 4 ขั้นตอนการใช้งาน, ตารางราคา Interactive, FAQ, ช่องทางติดต่อ\n2. **หน้ารายละเอียด & นโยบาย:** `/features`, `/guide`, `/terms`, `/privacy`, `/refund`\n3. **Mobile-First Design:** ปรับแต่ง UI ให้คมชัด ลื่นไหลบนมือถือเป็นหลัก\n4. **ภาพประกอบ & SEO:** สเปกรูปภาพ Next/Image, Metadata, Sitemap, OpenGraph (OG Image)",
          inline: false,
        },
        {
          name: "🎯 ขั้นตอนถัดไปหลังจากนี้",
          value: "• **Phase 3:** ระบบรับเงิน PromptPay QR ฝังยอด + อัปโหลดสลิปตรวจ Hash ซ้ำ + แจ้งเตือนแอดมิน\n• **Phase 4:** หลังบ้านแอดมิน + ระบบดึงสิทธิ์/ตัดสิทธิ์อัตโนมัติ (TradingView/Telegram/Discord)\n• **Phase 5:** เชื่อมต่อ Neon DB จริง + CI/CD + Deploy Vercel Production",
          inline: false,
        },
      ],
      footer: {
        text: "Peenoey Dev Engine • Single Solo Senior Full-Stack Workflow",
      },
      timestamp: new Date().toISOString(),
    },
  ],
};

try {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (response.ok || response.status === 204) {
    console.log("Successfully sent project status update to Discord webhook!");
  } else {
    const errorText = await response.text();
    console.error(`Failed to send Discord webhook: ${response.status} - ${errorText}`);
    process.exit(1);
  }
} catch (err) {
  console.error("Error executing fetch to Discord webhook:", err);
  process.exit(1);
}
