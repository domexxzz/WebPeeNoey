import type { Broker, PrismaClient } from "@prisma/client";
import { BROKERS, BROKER_ORDER } from "@/config/broker-ib";
import { SYSTEM_SETTING_ID } from "@/lib/db/constants";
import { normalizeBrokerLink } from "./validation";

export interface BrokerOffer {
  broker: Broker;
  label: string;
  link: string;
}

export type BrokerIbAvailability =
  | { open: true; minDepositUsd: number; brokers: BrokerOffer[] }
  | { open: false; reason: "DISABLED" | "MAINTENANCE" | "NOT_CONFIGURED" };

export interface BrokerIbSettingValues {
  ibClaimsEnabled: boolean;
  maintenanceMode: boolean;
  ibXmLink: string;
  ibExnessLink: string;
  ibMinDepositUsd: number | null;
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
  if (setting.ibMinDepositUsd === null) return { open: false, reason: "NOT_CONFIGURED" };

  const brokers: BrokerOffer[] = [];
  for (const broker of BROKER_ORDER) {
    const link = normalizeBrokerLink(setting[LINK_FIELD[broker]]);
    if (link.ok && link.url) brokers.push({ broker, label: BROKERS[broker].label, link: link.url });
  }
  if (brokers.length === 0) return { open: false, reason: "NOT_CONFIGURED" };
  return { open: true, minDepositUsd: setting.ibMinDepositUsd, brokers };
}

export async function readBrokerIbSettingValues(db: PrismaClient): Promise<BrokerIbSettingValues | null> {
  const setting = await db.systemSetting.findUnique({ where: { id: SYSTEM_SETTING_ID } });
  if (!setting) return null;
  return {
    ibClaimsEnabled: setting.ibClaimsEnabled,
    maintenanceMode: setting.maintenanceMode,
    ibXmLink: setting.ibXmLink,
    ibExnessLink: setting.ibExnessLink,
    ibMinDepositUsd: setting.ibMinDepositUsd?.toNumber() ?? null,
  };
}

export async function getBrokerIbAvailability(db: PrismaClient): Promise<BrokerIbAvailability> {
  return computeBrokerIbAvailability(await readBrokerIbSettingValues(db));
}
