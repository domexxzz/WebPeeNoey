/**
 * ฟิสิกส์ของบัตรสมาชิกกระดาษ 3 มิติ — ฟังก์ชันล้วน (ไม่แตะ DOM) ทดสอบได้ใน Node
 * หน่วย: มุมเป็นองศา, ความเร็วเป็นองศา/วินาที, เวลาเป็นมิลลิวินาที
 */

export type CardSide = "front" | "back";

export interface Spring {
  value: number;
  velocity: number;
}

const HALF_TURN = 180;
/** ลากแนวนอน 1 พิกเซล = หมุนกี่องศา */
const DRAG_DEG_PER_PX = 0.45;
/** ลากแนวตั้ง 1 พิกเซล = ก้มเงยกี่องศา และเพดานก้มเงยขณะลาก */
const DRAG_TILT_PER_PX = 0.15;
const MAX_DRAG_TILT = 18;
/** เอียงตามเมาส์สูงสุด (แกน X = ก้มเงย, แกน Y = ส่าย) */
const MAX_HOVER_TILT_X = 10;
const MAX_HOVER_TILT_Y = 14;
/** ปล่อยมือแล้วคาดว่าบัตรไหลต่อด้วยความเร็วเดิมอีกกี่วินาที (ใช้เลือกด้านที่จะหยุด) */
const FLICK_PROJECTION_S = 0.22;
/** สะบัดแรงแค่ไหนก็หมุนไม่เกินหนึ่งรอบ */
const MAX_SPIN = 360;
/** สปริง: แข็งพอให้ตามทัน หน่วงน้อยกว่าวิกฤตเล็กน้อยให้เด้งเกินนิดเดียวแบบกระดาษ */
const STIFFNESS = 170;
const DAMPING = 20;
/** ช่วงเวลาย่อยของสปริง และเวลาสูงสุดต่อเฟรม (แท็บกลับมาหลังพักนานจะไม่กระโดด) */
const SUBSTEP_S = 1 / 120;
const MAX_FRAME_MS = 64;
/** น้ำหนักความเร็วล่าสุดเวลาเฉลี่ยความเร็วขณะลาก */
const VELOCITY_SMOOTHING = 0.25;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
/** ตัด -0 ออก (เทียบค่าแล้วไม่สับสน และไม่ได้ "-0deg" ในสไตล์) */
const plain = (value: number) => value + 0;

/** ด้านที่ใกล้ที่สุด (ทุก 180°) */
export function nearestTurn(angle: number): number {
  return plain(Math.round(angle / HALF_TURN) * HALF_TURN);
}

/** ด้านที่หันเข้าหาผู้ชม ณ มุมนี้ */
export function sideAt(angle: number): CardSide {
  return Math.abs(nearestTurn(angle) / HALF_TURN) % 2 === 0 ? "front" : "back";
}

/** ปล่อยมือ: ไหลต่อตามแรงส่ง (ไม่เกินหนึ่งรอบ) แล้วหยุดที่ด้านใกล้สุดของจุดนั้น */
export function releaseTarget(angle: number, velocity: number): number {
  const travel = clamp(velocity * FLICK_PROJECTION_S, -MAX_SPIN, MAX_SPIN);
  return nearestTurn(angle + travel);
}

/** พลิกไปอีกด้านจากด้านที่บัตรกำลังมุ่งไป */
export function flipTarget(angle: number): number {
  return nearestTurn(angle) + HALF_TURN;
}

export function dragTurn(startAngle: number, dx: number): number {
  return startAngle + dx * DRAG_DEG_PER_PX;
}

export function dragTiltX(dy: number): number {
  return plain(clamp(-dy * DRAG_TILT_PER_PX, -MAX_DRAG_TILT, MAX_DRAG_TILT));
}

/** px/py = ตำแหน่งเมาส์ -1..1 จากกึ่งกลาง → มุมเอียงเข้าหาเมาส์ */
export function hoverTilt(px: number, py: number): { x: number; y: number } {
  return {
    x: plain(-clamp(py, -1, 1) * MAX_HOVER_TILT_X),
    y: plain(clamp(px, -1, 1) * MAX_HOVER_TILT_Y),
  };
}

/** เดินสปริงไปหาเป้าหมาย (แบ่งเป็นช่วงย่อยเพื่อความเสถียร) */
export function stepSpring(spring: Spring, target: number, dtMs: number): Spring {
  let remaining = clamp(dtMs, 0, MAX_FRAME_MS) / 1000;
  let { value, velocity } = spring;
  while (remaining > 0) {
    const step = Math.min(SUBSTEP_S, remaining);
    velocity += (STIFFNESS * (target - value) - DAMPING * velocity) * step;
    value += velocity * step;
    remaining -= step;
  }
  return { value, velocity };
}

export function isSettled(spring: Spring, target: number, tolerance = 0.05): boolean {
  return Math.abs(spring.value - target) < tolerance && Math.abs(spring.velocity) < tolerance * 10;
}

/** ความเร็วเฉลี่ยขณะลาก (องศา/วินาที) — ช่วงเวลาเป็นศูนย์คงค่าเดิมไว้ */
export function trackVelocity(previous: number, deltaAngle: number, dtMs: number): number {
  if (dtMs <= 0) return previous;
  const instant = (deltaAngle / dtMs) * 1000;
  return previous + (instant - previous) * VELOCITY_SMOOTHING;
}

const radians = (angle: number) => (angle * Math.PI) / 180;

/** เงาที่ขอบเมื่อบัตรหันข้าง (0 = หันตรง, 1 = หันข้างเต็มที่) */
export function edgeShade(angle: number): number {
  return plain(Math.abs(Math.sin(radians(angle))));
}

/** ตำแหน่งแถบแสงสะท้อนบนกระดาษ (0..100%) — เลื่อนผ่านหน้าบัตรตามมุมหมุน */
export function sheenOffset(angle: number): number {
  return 50 - Math.sin(radians(angle)) * 50;
}

/** ขยับน้อยกว่านี้ (พิกเซล) ถือว่าแตะ ไม่ใช่ลาก — นิ้วสั่นมากกว่าเมาส์ */
export function tapSlop(pointerType: string): number {
  return pointerType === "mouse" ? 4 : 10;
}

/** แถบแสงสะท้อนกว้าง 3 เท่าของบัตร แสงอยู่กลางแถบ → เลื่อนแถบ (% ของความกว้างแถบ) ให้แสงไปอยู่ที่จุด sheen% ของบัตร */
export function sheenTranslate(sheenPercent: number): number {
  return (sheenPercent - 150) / 3;
}

/** มุมบนซ้ายของวงแสง (พิกเซล) ให้กึ่งกลางวงอยู่ใต้เมาส์ — ด้านหลังบัตรกลับซ้ายขวา (หมุนมา 180°) */
export function lightOffset(px: number, py: number, width: number, height: number, size: number) {
  const x = ((px + 1) / 2) * width - size / 2;
  const y = ((py + 1) / 2) * height - size / 2;
  return { x: plain(x), xBack: plain(width - size - x), y: plain(y) };
}

/** ขนาดตัวอักษรรอบตราประทับ ให้ข้อความยาวเท่าไรก็พอดีหนึ่งรอบ (ไม่ยืดห่างหรือเบียดทับ) */
export function sealFontSize(characters: number, circumference: number): number {
  return clamp(circumference / (Math.max(characters, 1) * 0.86), 6, 9);
}
