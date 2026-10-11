import { randomInt } from "crypto";
import { PAYMENT_RULES } from "@/config/payment";

export interface PricingPlan {
  price: number;
  originalPrice: number | null;
  isPromo: boolean;
  promoLimit: number | null;
  promoEnrolledCount: number;
}

export type PriceReason = "LOCKED" | "PROMO" | "REGULAR";

export interface PriceQuote {
  basePrice: number;
  reason: PriceReason;
}

/**
 * คำนวณราคาก่อนหักเศษสตางค์
 * 1. สมาชิกที่มีสิทธิ์ล็อกราคา → ราคาที่ล็อกไว้
 * 2. แพ็กเกจโปรโมชันที่ยังมีโควตา → ราคาโปรโมชัน (plan.price)
 * 3. นอกนั้น → ราคาปกติ (originalPrice ถ้ามี)
 */
export function quotePlanPrice(plan: PricingPlan, lockedPrice: number | null): PriceQuote {
  if (lockedPrice !== null) return { basePrice: lockedPrice, reason: "LOCKED" };
  const hasPromoSeat = plan.isPromo && (plan.promoLimit === null || plan.promoEnrolledCount < plan.promoLimit);
  if (hasPromoSeat) return { basePrice: plan.price, reason: "PROMO" };
  return { basePrice: plan.originalPrice ?? plan.price, reason: "REGULAR" };
}

/** หักเศษสตางค์ออกจากราคา (คำนวณเป็นสตางค์เพื่อเลี่ยงทศนิยมคลาดเคลื่อน) */
export function applySatangDiscount(basePrice: number, satang: number): number {
  return (Math.round(basePrice * 100) - satang) / 100;
}

/**
 * เลือกเศษสตางค์ที่ยังไม่มีออเดอร์ค้างอื่นที่ราคาเดียวกันใช้อยู่ เพื่อให้แอดมินจับคู่ยอดโอนกับออเดอร์ได้
 * คืน null เมื่อใช้ครบทุกค่าแล้ว — ห้ามใช้ยอดซ้ำ เพราะแอดมินจะแยกไม่ออกว่าเงินโอนเป็นของออเดอร์ไหน
 */
export function pickSatangDiscount(
  taken: Set<number>,
  random: () => number = () => randomInt(0, 1_000_000) / 1_000_000,
): number | null {
  const { min, max } = PAYMENT_RULES.satangDiscountRange;
  const free = Array.from({ length: max - min + 1 }, (_, index) => min + index).filter((value) => !taken.has(value));
  if (free.length === 0) return null;
  return free[Math.min(free.length - 1, Math.floor(random() * free.length))];
}
