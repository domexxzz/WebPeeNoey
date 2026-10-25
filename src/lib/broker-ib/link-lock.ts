import type { Broker } from "@prisma/client";
import { normalizeBrokerLink } from "./validation";

/**
 * ล็อกลิงก์พาร์ทเนอร์ด้วยค่าบนเซิร์ฟเวอร์ (env บน Render) — ตั้งแล้วหน้าแอดมินแก้ลิงก์โบรกเกอร์นั้นไม่ได้
 * และหน้าเว็บใช้ค่านี้เสมอแม้ค่าในฐานข้อมูลถูกแก้ตรง ๆ (กันคนที่ได้สิทธิ์แอดมิน/ฐานข้อมูลเปลี่ยนรายได้ IB ไปเข้าบัญชีอื่น)
 * ค่าที่ไม่ใช่ https หรือรูปแบบผิด = ไม่ล็อก
 */
export type LockedLinks = Partial<Record<Broker, string>>;

const ENV_KEYS: Record<Broker, "XM_PARTNER_LINK" | "EXNESS_PARTNER_LINK"> = { XM: "XM_PARTNER_LINK", EXNESS: "EXNESS_PARTNER_LINK" };

export function readLockedLinks(
  env: { XM_PARTNER_LINK?: string; EXNESS_PARTNER_LINK?: string } = {
    XM_PARTNER_LINK: process.env.XM_PARTNER_LINK,
    EXNESS_PARTNER_LINK: process.env.EXNESS_PARTNER_LINK,
  },
): LockedLinks {
  const locked: LockedLinks = {};
  for (const broker of Object.keys(ENV_KEYS) as Broker[]) {
    const link = normalizeBrokerLink(env[ENV_KEYS[broker]] ?? "");
    if (link.ok && link.url) locked[broker] = link.url;
  }
  return locked;
}

export const LOCKED_LINK_ENV_KEY = ENV_KEYS;
