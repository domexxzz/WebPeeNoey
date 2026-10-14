/**
 * คอมมูนิตี้ Discord ของแบรนด์ — ลิงก์เชิญเปิดสาธารณะ (ไม่ใช่ความลับ) ตั้งทับได้ด้วย NEXT_PUBLIC_DISCORD_INVITE
 * สมาชิกที่ได้รับสิทธิ์ (ชำระเงิน / ผ่าน IB) ได้ยศ VIP — ทีมงานให้ยศด้วยมือหลังสมาชิกแจ้งชื่อผู้ใช้ Discord
 * ห้ามแสดงจำนวนสมาชิก/ออนไลน์ (เจ้าของเลือกไม่แสดง)
 */

const DEFAULT_DISCORD_INVITE = "https://discord.gg/erJFe57YY";
const INVITE_PATTERN = /^https:\/\/(?:discord\.gg\/|(?:www\.)?discord\.com\/invite\/)[A-Za-z0-9-]{2,32}\/?$/;

/** ลิงก์เชิญ Discord ที่ถูกต้องเท่านั้น (https://discord.gg/<code> หรือ https://discord.com/invite/<code>) — ไม่ถูกต้อง = null (ซ่อนปุ่ม) */
export function normalizeDiscordInvite(raw: string | undefined | null): string | null {
  const value = raw?.trim() ?? "";
  return INVITE_PATTERN.test(value) ? value.replace(/\/$/, "") : null;
}

export const COMMUNITY = {
  discord: {
    name: "Noble Gold Society",
    inviteUrl: normalizeDiscordInvite(process.env.NEXT_PUBLIC_DISCORD_INVITE || DEFAULT_DISCORD_INVITE),
    eyebrow: "คอมมูนิตี้",
    title: "คุยกับเทรดเดอร์ทองคำ บน Discord",
    description:
      "เข้าร่วมเซิร์ฟเวอร์ Noble Gold Society เพื่อพูดคุย แลกเปลี่ยนมุมมองกราฟ และติดตามข่าวจากทีมงาน — สมาชิกที่ได้รับสิทธิ์ใช้งานจะได้ยศ VIP เข้าห้องเฉพาะสมาชิก",
    joinLabel: "เข้าร่วม Discord",
    vipHint: "เข้าร่วมเซิร์ฟเวอร์แล้วแจ้งชื่อผู้ใช้ Discord กับทีมงาน เพื่อรับยศ VIP",
  },
} as const;
