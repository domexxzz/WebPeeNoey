import type { Broker } from "@prisma/client";
import { BROKER_IB_RULES } from "@/config/broker-ib";

/**
 * ยอดฝากขั้นต่ำตั้งเป็นเงินบาทรายโบรกเกอร์ แต่รายงานของ XM / Exness แสดงยอดฝากเป็น USD
 * จึงแปลงขั้นต่ำเป็น USD ด้วยอัตราที่แอดมินตั้งไว้ แล้วเทียบกับยอดในรายงาน (ฟังก์ชันล้วน)
 */

export interface BrokerMinimums {
  ibMinDepositXmThb: number | null;
  ibMinDepositExnessThb: number | null;
  ibUsdThbRate: number | null;
}

const THB_FIELD: Record<Broker, "ibMinDepositXmThb" | "ibMinDepositExnessThb"> = {
  XM: "ibMinDepositXmThb",
  EXNESS: "ibMinDepositExnessThb",
};

/** บาท → USD ตามอัตราที่ตั้งไว้ (ปัดเศษ 2 ตำแหน่ง) — ไม่มีค่า/อัตราไม่ถูกต้อง = null ไม่หารด้วยศูนย์ */
export function convertThbToUsd(thb: number | null, rate: number | null): number | null {
  if (thb === null || rate === null || !(thb > 0) || !(rate > 0)) return null;
  return Math.round((thb / rate) * 100) / 100;
}

/** ยอดในรายงานถึงขั้นต่ำไหม — ผ่อนผันได้ตาม depositTolerance (กันค่าคลาดจากการแปลงสกุลเงินของโบรกเกอร์) */
export function meetsMinimumDeposit(depositUsd: number, minimumUsd: number): boolean {
  return depositUsd >= minimumUsd * (1 - BROKER_IB_RULES.depositTolerance);
}

/** ขั้นต่ำของโบรกเกอร์นั้น (บาท + USD ที่แปลงแล้ว) — null = ยังตั้งไม่ครบ จึงยังไม่เปิดให้ยื่น */
export function minimumForBroker(broker: Broker, setting: BrokerMinimums): { thb: number; usd: number } | null {
  const thb = setting[THB_FIELD[broker]];
  const usd = convertThbToUsd(thb, setting.ibUsdThbRate);
  return thb !== null && usd !== null ? { thb, usd } : null;
}
