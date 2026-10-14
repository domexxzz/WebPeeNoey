import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getBrokerIbAvailability, type BrokerIbAvailability } from "./availability";

/** แท็กแคชของข้อเสนอสิทธิ์ผ่าน IB บนหน้าเว็บสาธารณะ — การตั้งค่าเปลี่ยนแล้วเรียก revalidateTag ทันที */
export const BROKER_IB_OFFER_TAG = "broker-ib-offer";
const OFFER_REVALIDATE_SECONDS = 300;

/**
 * ข้อเสนอสำหรับหน้าเว็บสาธารณะ (แคชไว้ ไม่ query ทุกครั้งที่มีคนเข้าหน้าแรก)
 * อ่านฐานข้อมูลไม่ได้ → ซ่อนข้อเสนอไว้ก่อน (ปิดแบบปลอดภัย) และ log ให้เห็นใน Vercel
 */
export const getCachedBrokerIbOffer = unstable_cache(
  async (): Promise<BrokerIbAvailability> => {
    try {
      return await getBrokerIbAvailability(prisma);
    } catch (error) {
      console.error("[broker-ib] โหลดการตั้งค่าสิทธิ์ผ่าน IB ไม่สำเร็จ — ซ่อนข้อเสนอไว้ก่อน", error);
      return { open: false, reason: "NOT_CONFIGURED" };
    }
  },
  [BROKER_IB_OFFER_TAG],
  { revalidate: OFFER_REVALIDATE_SECONDS, tags: [BROKER_IB_OFFER_TAG] },
);
