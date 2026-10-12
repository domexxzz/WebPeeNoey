import type { CSSProperties } from "react";

/** ตัวช่วยของอนิเมชันหน้าบ้าน — ฟังก์ชันล้วน (ไม่แตะ DOM จริง) จึงทดสอบได้ใน Node */

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** เป้าหมายที่ยังไม่ได้เผย — runtime ใส่ data-inview เมื่อเลื่อนมาถึง */
export const REVEAL_SELECTOR = "[data-reveal]:not([data-inview])";
/** กลุ่มที่มีอนิเมชันวนไม่รู้จบ — หยุดชั่วคราวเมื่ออยู่นอกจอ */
export const LOOP_SELECTOR = "[data-loop]";
/** เวลาที่ CSS กันพลาดจะแสดงทุกอย่างเอง ถ้า runtime ยังไม่เริ่ม (ต้องตรงกับ motion.css) */
export const FAILSAFE_MS = 2500;
/** คีย์ localStorage ของปุ่มหยุดภาพเคลื่อนไหว */
export const MOTION_PREFERENCE_KEY = "peenoey-motion";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * ตำแหน่งเมาส์เทียบกับกล่อง: px/py อยู่ในช่วง -1..1 (0 = กึ่งกลาง) สำหรับเอียง/ดูด
 * ส่วน x/y เป็นพิกเซลภายในกล่อง สำหรับแสงสปอตไลต์
 */
export function pointerRatio(box: Box, clientX: number, clientY: number) {
  if (box.width <= 0 || box.height <= 0) return { px: 0, py: 0, x: 0, y: 0 };
  const x = clamp(clientX - box.left, 0, box.width);
  const y = clamp(clientY - box.top, 0, box.height);
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return { px: round((x / box.width) * 2 - 1), py: round((y / box.height) * 2 - 1), x: Math.round(x), y: Math.round(y) };
}

/** สัดส่วนการเลื่อนหน้า 0..1 สำหรับแถบความคืบหน้า */
export function scrollProgress(scrollY: number, scrollHeight: number, viewportHeight: number): number {
  const scrollable = scrollHeight - viewportHeight;
  if (scrollable <= 0) return 0;
  return clamp(scrollY / scrollable, 0, 1);
}

/** ระยะเลื่อนขั้นต่ำก่อนซ่อน header (ด้านบนสุดของหน้าต้องเห็นเมนูเสมอ) */
export const HEADER_HIDE_AFTER = 120;
/** ระยะเลื่อนขั้นต่ำที่นับว่า "เปลี่ยนทิศ" — กันกระพริบจากการเลื่อนเล็กน้อย */
const SCROLL_JITTER = 4;

/** ซ่อน header เมื่อเลื่อนลงเลยระยะที่กำหนด และโผล่กลับทันทีที่เลื่อนขึ้น */
export function headerShouldHide(currentY: number, previousY: number): boolean {
  return currentY > HEADER_HIDE_AFTER && currentY > previousY;
}

export interface ScrollInput {
  y: number;
  previousY: number;
  scrollHeight: number;
  viewportHeight: number;
  /** โฟกัสอยู่ใน header หรือเมนูมือถือเปิดอยู่ → ห้ามซ่อน */
  keepHeaderVisible: boolean;
  headerHidden: boolean;
}

/** สถานะทั้งหมดที่ได้จากการเลื่อนหนึ่งครั้ง (แถบความคืบหน้า, เงา header, ซ่อน/โผล่ header) */
export function scrollState({ y, previousY, scrollHeight, viewportHeight, keepHeaderVisible, headerHidden }: ScrollInput) {
  const moved = Math.abs(y - previousY) > SCROLL_JITTER;
  const hidden = keepHeaderVisible ? false : moved ? headerShouldHide(y, previousY) : headerHidden;
  return {
    progress: scrollProgress(y, scrollHeight, viewportHeight),
    scrolled: y > 8,
    headerHidden: hidden,
    previousY: moved ? y : previousY,
  };
}

/**
 * runtime เริ่มช้ากว่า (หรือเกือบเท่า) เวลากันพลาด → CSS แสดงเนื้อหาไปแล้ว
 * ต้องถือว่าทุกชิ้น "เห็นแล้ว" ทันที ไม่อย่างนั้นเนื้อหาจะหายแล้วค่อยเฟดกลับมา
 */
export function startedAfterFailsafe(elapsedMs: number): boolean {
  return elapsedMs >= FAILSAFE_MS - 300;
}

interface QueryableNode {
  nodeType: number;
  matches?: (selector: string) => boolean;
  querySelectorAll?: (selector: string) => ArrayLike<unknown>;
}

/** หาเป้าหมายในโหนดที่เพิ่งถูกแทรก (ตัวเอง + ลูกหลาน) — ไม่ต้องสแกนทั้งหน้าทุกครั้งที่ DOM เปลี่ยน */
export function collectTargets<T>(nodes: Iterable<QueryableNode>, selector: string): T[] {
  const found: T[] = [];
  for (const node of nodes) {
    if (node.nodeType !== 1) continue;
    if (node.matches?.(selector)) found.push(node as unknown as T);
    const descendants = node.querySelectorAll?.(selector);
    if (descendants) found.push(...(Array.from(descendants) as T[]));
  }
  return found;
}

/** ค่าที่บันทึกไว้ของปุ่มหยุดภาพเคลื่อนไหว (อ่านพลาด/ไม่มีค่า = เล่นตามปกติ) */
export function readMotionPaused(read: () => string | null): boolean {
  try {
    return read() === "paused";
  } catch {
    return false;
  }
}

/** หน่วงเวลาไล่ลำดับ (stagger) เป็น CSS custom property — จำกัดเพดานไม่ให้ชิ้นท้าย ๆ รอนานเกินไป */
export function staggerStyle(index: number, stepMs = 80, maxMs = 720): CSSProperties {
  return { "--reveal-delay": `${Math.min(index * stepMs, maxMs)}ms` } as CSSProperties;
}

/** ลำดับชิ้นภายในกลุ่ม (ใช้คูณเวลาใน CSS เช่น calc(var(--i) * 60ms)) */
export function indexStyle(index: number): CSSProperties {
  return { "--i": index } as CSSProperties;
}

/** หน่วงเวลาอนิเมชันตอนโหลดหน้า (.mx-load / .mx-load-words) */
export function loadDelayStyle(ms: number): CSSProperties {
  return { "--load-delay": `${ms}ms` } as CSSProperties;
}
