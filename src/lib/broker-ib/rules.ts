import type { Broker, BrokerAccountStatus, TradingPlatform } from "@prisma/client";
import { BROKER_IB_RULES } from "@/config/broker-ib";
import type { BrokerIbAvailability } from "./availability";

/** กติกาสิทธิ์ผ่าน IB — ฟังก์ชันล้วน ทดสอบได้ใน Node */

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = BROKER_IB_RULES.renewalWindowDays * DAY_MS;

/**
 * ยื่นขอ/อนุมัติสิทธิ์ผ่าน IB ได้เมื่อช่วงสิทธิ์ถัดไปเริ่มภายใน BROKER_IB_RULES.renewalWindowDays (ไม่มีสิทธิ์ หรือสิทธิ์เหลือไม่เกิน BROKER_IB_RULES.renewalWindowDays)
 * กันการสะสมเดือนฟรีล่วงหน้า — ตรวจทั้งตอนยื่นและตอนอนุมัติ
 */
export function isWithinClaimWindow(nextStart: Date, now: Date): boolean {
  return nextStart.getTime() - now.getTime() <= WINDOW_MS;
}

export function claimWindowOpensAt(nextStart: Date): Date {
  return new Date(nextStart.getTime() - WINDOW_MS);
}

export interface BindingView {
  broker: Broker;
  platform: TradingPlatform;
  accountMasked: string;
  status: BrokerAccountStatus;
}

export interface PendingClaimView {
  orderNumber: string;
  submittedAt: Date;
  broker: Broker;
  platform: TradingPlatform;
  accountMasked: string;
  isRenewal: boolean;
}

export type BrokerIbMemberState =
  | { kind: "PENDING"; claim: PendingClaimView }
  | { kind: "CLOSED"; ibActiveUntil: Date | null }
  | { kind: "WAIT_WINDOW"; opensAt: Date; coveredUntil: Date }
  | { kind: "CAN_RENEW"; binding: BindingView; ibActiveUntil: Date | null; lastRejection: { reason: string; at: Date } | null }
  | { kind: "CAN_CLAIM"; binding: BindingView | null; lastRejection: { reason: string; at: Date } | null };

export interface MemberStateInput {
  now: Date;
  availability: BrokerIbAvailability;
  pendingClaim: PendingClaimView | null;
  /** บัญชีที่สมาชิกผูกอยู่ (PENDING / VERIFIED) — null ถ้าไม่มี */
  binding: BindingView | null;
  /** วันเริ่มช่วงสิทธิ์ถัดไป (nextPeriodFor) */
  nextStart: Date;
  /** วันสิ้นสุดสิทธิ์ผ่าน IB ล่าสุดที่ยังไม่หมด */
  ibActiveUntil: Date | null;
  lastRejection: { reason: string; at: Date } | null;
}

/**
 * สิ่งที่หน้าสมาชิกควรแสดง — ลำดับความสำคัญ:
 * คำขอที่รอตรวจ (แสดงแม้ปิดรับ) → ปิดรับ → ยังไม่ถึงช่วงยื่น → ต่ออายุบัญชีที่ยืนยันแล้ว → ยื่นใหม่
 */
export function resolveBrokerIbMemberState(input: MemberStateInput): BrokerIbMemberState {
  if (input.pendingClaim) return { kind: "PENDING", claim: input.pendingClaim };
  if (!input.availability.open) return { kind: "CLOSED", ibActiveUntil: input.ibActiveUntil };
  if (!isWithinClaimWindow(input.nextStart, input.now)) {
    return { kind: "WAIT_WINDOW", opensAt: claimWindowOpensAt(input.nextStart), coveredUntil: input.nextStart };
  }
  if (input.binding?.status === "VERIFIED") {
    return { kind: "CAN_RENEW", binding: input.binding, ibActiveUntil: input.ibActiveUntil, lastRejection: input.lastRejection };
  }
  return { kind: "CAN_CLAIM", binding: input.binding, lastRejection: input.lastRejection };
}
