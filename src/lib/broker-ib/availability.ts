import type { Broker, PrismaClient } from "@prisma/client";
import { BROKERS, BROKER_ORDER } from "@/config/broker-ib";
import { SYSTEM_SETTING_ID } from "@/lib/db/constants";
import { normalizeBrokerLink } from "./validation";
import { readLockedLinks, type LockedLinks } from "./link-lock";
import { minimumForBroker, type BrokerMinimums } from "./deposit";

export interface BrokerOffer {
  broker: Broker;
  label: string;
  link: string;
  /** ยอดฝากขั้นต่ำของโบรกเกอร์นี้ (บาท) และค่าที่แปลงเป็น USD ไว้เทียบกับรายงาน */
  minDepositThb: number;
  minDepositUsd: number;
}

export type BrokerIbAvailability =
  | { open: true; usdThbRate: number; brokers: BrokerOffer[] }
  | { open: false; reason: "DISABLED" | "MAINTENANCE" | "NOT_CONFIGURED" };

export interface BrokerIbSettingValues extends BrokerMinimums {
  ibClaimsEnabled: boolean;
  maintenanceMode: boolean;
  ibXmLink: string;
  ibExnessLink: string;
}

const LINK_FIELD: Record<Broker, "ibXmLink" | "ibExnessLink"> = { XM: "ibXmLink", EXNESS: "ibExnessLink" };

/**
 * เปิดให้ขอสิทธิ์ผ่าน IB ได้หรือไม่ (ฟังก์ชันล้วน)
 * ต้องเปิดสวิตช์, ไม่อยู่ในโหมดปิดปรับปรุง, ตั้งยอดฝากขั้นต่ำแล้ว และมีลิงก์ที่ถูกต้องอย่างน้อย 1 โบรกเกอร์
 * ลิงก์ถูกตรวจซ้ำทุกครั้งที่อ่าน — ค่าที่ถูกแก้ในฐานข้อมูลโดยตรงจะไม่ถูกแสดง
 */
export function computeBrokerIbAvailability(setting: BrokerIbSettingValues | null): BrokerIbAvailability {
  if (!setting?.ibClaimsEnabled) return { open: false, reason: "DISABLED" };
  if (setting.maintenanceMode) return { open: false, reason: "MAINTENANCE" };
  if (setting.ibUsdThbRate === null) return { open: false, reason: "NOT_CONFIGURED" };

  const brokers: BrokerOffer[] = [];
  for (const broker of BROKER_ORDER) {
    const link = normalizeBrokerLink(setting[LINK_FIELD[broker]]);
    const minimum = minimumForBroker(broker, setting);
    // เสนอเฉพาะโบรกเกอร์ที่มีทั้งลิงก์และยอดฝากขั้นต่ำ — ขาดอย่างใดอย่างหนึ่งแปลว่ายังตั้งค่าไม่เสร็จ
    if (link.ok && link.url && minimum) {
      brokers.push({ broker, label: BROKERS[broker].label, link: link.url, minDepositThb: minimum.thb, minDepositUsd: minimum.usd });
    }
  }
  if (brokers.length === 0) return { open: false, reason: "NOT_CONFIGURED" };
  return { open: true, usdThbRate: setting.ibUsdThbRate, brokers };
}

/** ลิงก์ที่ล็อกด้วย env มาก่อนค่าในฐานข้อมูลเสมอ (ค่าในฐานข้อมูลถูกแก้ตรง ๆ ก็ไม่ถูกแสดง) */
export async function readBrokerIbSettingValues(db: PrismaClient, lockedLinks: LockedLinks = readLockedLinks()): Promise<BrokerIbSettingValues | null> {
  const setting = await db.systemSetting.findUnique({ where: { id: SYSTEM_SETTING_ID } });
  if (!setting) return null;
  return {
    ibClaimsEnabled: setting.ibClaimsEnabled,
    maintenanceMode: setting.maintenanceMode,
    ibXmLink: lockedLinks.XM ?? setting.ibXmLink,
    ibExnessLink: lockedLinks.EXNESS ?? setting.ibExnessLink,
    ibMinDepositXmThb: setting.ibMinDepositXmThb?.toNumber() ?? null,
    ibMinDepositExnessThb: setting.ibMinDepositExnessThb?.toNumber() ?? null,
    ibUsdThbRate: setting.ibUsdThbRate?.toNumber() ?? null,
  };
}

export async function getBrokerIbAvailability(db: PrismaClient): Promise<BrokerIbAvailability> {
  return computeBrokerIbAvailability(await readBrokerIbSettingValues(db));
}
