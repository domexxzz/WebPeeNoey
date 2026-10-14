import { pointerRatio } from "@/lib/motion";
import {
  dragTiltX,
  dragTurn,
  edgeShade,
  flipTarget,
  hoverTilt,
  isSettled,
  lightOffset,
  releaseTarget,
  sheenOffset,
  sheenTranslate,
  sideAt,
  stepSpring,
  tapSlop,
  trackVelocity,
  type CardSide,
  type Spring,
} from "@/lib/paper-card";

/**
 * ตัวขับบัตรกระดาษ 3 มิติ (ใช้คู่กับ member-card.tsx และ src/styles/paper-card.css)
 * - เมาส์ชี้: เอียงเข้าหาเมาส์ + วงแสงใต้เมาส์ + ฉากหลังขยับตามความลึก (--px/--py บนเวที)
 * - จับลาก (เมาส์/นิ้ว/ปากกา): หมุนตามมือ ปล่อยแล้วไหลต่อตามแรงส่ง แล้วหยุดที่ด้านใกล้สุด
 * - แตะ/คลิกโดยไม่ลาก: พลิกด้าน (ใช้ click — แตะเพื่อหยุดการเลื่อนหน้าไม่มี click จึงไม่พลิกเอง)
 * - ระหว่างลากฟังที่ window: ปล่อยนอกบัตร, จับ pointer ไม่ได้, เสีย capture, สลับหน้าต่าง → จบการลากเสมอ ไม่ค้าง
 * - วนเฟรมเฉพาะตอนที่ยังขยับ — นิ่งแล้ววางตรงด้านพอดีแล้วหยุด; ขยับเฉพาะ transform/translate/opacity
 * - ลดการเคลื่อนไหว: ไม่เอียง ไม่ลากหมุน แตะ/ลาก/ปุ่ม = พลิกทันทีไม่มีแอนิเมชัน
 */

/** ค้างนิ่งก่อนปล่อยนานกว่านี้ (มิลลิวินาที) = ไม่มีแรงส่ง */
const STILL_RELEASE_MS = 90;
/** เส้นผ่านศูนย์กลางวงแสงตามเมาส์ — ต้องตรงกับ .pc-light ใน paper-card.css */
const LIGHT_SIZE = 240;

type SpringKey = "turn" | "tiltX" | "tiltY";
const SPRING_KEYS: SpringKey[] = ["turn", "tiltX", "tiltY"];

interface DragState {
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  startTurn: number;
  lastTime: number;
  velocity: number;
  moved: boolean;
}

export interface CardMotionOptions {
  reducedMotion: boolean;
  /** เมาส์จริง (ไม่ใช่จอสัมผัส) — เปิดการเอียงตามเมาส์ */
  finePointer: boolean;
  onSideChange: (side: CardSide) => void;
}

export interface CardMotion {
  flip: () => void;
  destroy: () => void;
}

export function attachCardMotion(stage: HTMLElement, card: HTMLElement, options: CardMotionOptions): CardMotion {
  const springs: Record<SpringKey, Spring> = {
    turn: { value: 0, velocity: 0 },
    tiltX: { value: 0, velocity: 0 },
    tiltY: { value: 0, velocity: 0 },
  };
  const targets: Record<SpringKey, number> = { turn: 0, tiltX: 0, tiltY: 0 };
  let drag: DragState | null = null;
  let pendingTap = false;
  let side: CardSide = "front";
  let frame = 0;
  let lastFrame = 0;

  const paint = () => {
    const angle = springs.turn.value + springs.tiltY.value;
    card.style.transform = `rotateX(${springs.tiltX.value.toFixed(2)}deg) rotateY(${angle.toFixed(2)}deg)`;
    card.style.setProperty("--shade", edgeShade(angle).toFixed(3));
    card.style.setProperty("--sheen-x", `${sheenTranslate(sheenOffset(angle)).toFixed(2)}%`);
  };

  const showSide = (next: CardSide) => {
    if (next === side) return;
    side = next;
    options.onSideChange(next);
  };

  /** วางทุกค่าตรงเป้าหมายพอดี (นิ่งแล้ว หรือโหมดลดการเคลื่อนไหว) */
  const snap = () => {
    for (const key of SPRING_KEYS) springs[key] = { value: targets[key], velocity: 0 };
    paint();
  };

  const tick = (now: number) => {
    const dt = now - lastFrame;
    lastFrame = now;
    for (const key of SPRING_KEYS) {
      if (key === "turn" && drag) continue;
      springs[key] = stepSpring(springs[key], targets[key], dt);
    }
    const settled = !drag && SPRING_KEYS.every((key) => isSettled(springs[key], targets[key]));
    if (settled) {
      frame = 0;
      snap();
      return;
    }
    paint();
    frame = requestAnimationFrame(tick);
  };

  const wake = () => {
    if (options.reducedMotion) {
      snap();
      return;
    }
    if (frame) return;
    lastFrame = performance.now();
    frame = requestAnimationFrame(tick);
  };

  const flip = () => {
    targets.turn = flipTarget(targets.turn);
    showSide(sideAt(targets.turn));
    wake();
  };

  const finishDrag = (timeStamp: number, cancelled: boolean) => {
    const current = drag;
    if (!current) return;
    drag = null;
    watchDrag(false);
    card.removeAttribute("data-dragging");
    targets.tiltX = 0;
    pendingTap = !cancelled && (!current.moved || options.reducedMotion);
    if (current.moved && !options.reducedMotion) {
      const velocity = timeStamp - current.lastTime > STILL_RELEASE_MS ? 0 : current.velocity;
      targets.turn = releaseTarget(springs.turn.value, velocity);
      springs.turn = { value: springs.turn.value, velocity };
      showSide(sideAt(targets.turn));
    }
    wake();
  };

  const onDragMove = (event: PointerEvent) => {
    const current = drag;
    if (!current || event.pointerId !== current.pointerId) return;
    // ปุ่มเมาส์ไม่ได้กดอยู่แล้ว = พลาดอีเวนต์ปล่อยไป (เช่นปล่อยนอกหน้าต่าง) → จบการลาก
    if (event.pointerType === "mouse" && event.buttons === 0) {
      finishDrag(event.timeStamp, true);
      return;
    }
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < tapSlop(current.pointerType)) return;
    current.moved = true;
    if (options.reducedMotion) return;
    const next = dragTurn(current.startTurn, dx);
    current.velocity = trackVelocity(current.velocity, next - springs.turn.value, event.timeStamp - current.lastTime);
    current.lastTime = event.timeStamp;
    springs.turn = { value: next, velocity: 0 };
    targets.turn = next;
    targets.tiltX = dragTiltX(dy);
    showSide(sideAt(next));
    wake();
  };

  const onPointerUp = (event: PointerEvent) => {
    if (drag && event.pointerId === drag.pointerId) finishDrag(event.timeStamp, false);
  };
  const onPointerCancel = (event: PointerEvent) => {
    if (drag && event.pointerId === drag.pointerId) finishDrag(event.timeStamp, true);
  };
  const onBlur = () => finishDrag(performance.now(), true);

  function watchDrag(on: boolean) {
    const update = on ? window.addEventListener.bind(window) : window.removeEventListener.bind(window);
    update("pointermove", onDragMove as EventListener);
    update("pointerup", onPointerUp as EventListener);
    update("pointercancel", onPointerCancel as EventListener);
    update("blur", onBlur);
  }

  const onPointerDown = (event: PointerEvent) => {
    if (drag || (event.pointerType === "mouse" && event.button !== 0)) return;
    pendingTap = false;
    try {
      card.setPointerCapture(event.pointerId);
    } catch {
      // จับ pointer ไม่ได้ (pointer จบไปแล้ว) — ตัวฟังที่ window ยังเห็นการปล่อยนอกบัตร
    }
    drag = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      startTurn: springs.turn.value,
      lastTime: event.timeStamp,
      velocity: 0,
      moved: false,
    };
    targets.tiltY = 0;
    if (!options.reducedMotion) card.setAttribute("data-dragging", "");
    watchDrag(true);
  };

  const onClick = () => {
    if (!pendingTap) return;
    pendingTap = false;
    flip();
  };

  const onLostCapture = (event: PointerEvent) => {
    if (drag && event.pointerId === drag.pointerId) finishDrag(event.timeStamp, true);
  };

  const onHover = (event: PointerEvent) => {
    if (drag || !options.finePointer || options.reducedMotion || event.pointerType !== "mouse") return;
    const { px, py } = pointerRatio(stage.getBoundingClientRect(), event.clientX, event.clientY);
    const tilt = hoverTilt(px, py);
    targets.tiltX = tilt.x;
    targets.tiltY = tilt.y;
    stage.style.setProperty("--px", String(px));
    stage.style.setProperty("--py", String(py));
    // ขนาดจริงของบัตร (offsetWidth ไม่เปลี่ยนตามมุมเอียง) — วงแสงจึงไม่สั่นตามการหมุน
    const light = lightOffset(px, py, card.offsetWidth, card.offsetHeight, LIGHT_SIZE);
    card.style.setProperty("--lx", `${light.x.toFixed(1)}px`);
    card.style.setProperty("--lx-back", `${light.xBack.toFixed(1)}px`);
    card.style.setProperty("--ly", `${light.y.toFixed(1)}px`);
    card.setAttribute("data-lit", "");
    wake();
  };

  const onLeave = () => {
    if (drag) return;
    targets.tiltX = 0;
    targets.tiltY = 0;
    stage.style.setProperty("--px", "0");
    stage.style.setProperty("--py", "0");
    card.removeAttribute("data-lit");
    wake();
  };

  card.addEventListener("pointerdown", onPointerDown);
  card.addEventListener("click", onClick);
  card.addEventListener("lostpointercapture", onLostCapture);
  stage.addEventListener("pointermove", onHover);
  stage.addEventListener("pointerleave", onLeave);
  paint();

  return {
    flip,
    destroy: () => {
      cancelAnimationFrame(frame);
      frame = 0;
      watchDrag(false);
      card.removeEventListener("pointerdown", onPointerDown);
      card.removeEventListener("click", onClick);
      card.removeEventListener("lostpointercapture", onLostCapture);
      stage.removeEventListener("pointermove", onHover);
      stage.removeEventListener("pointerleave", onLeave);
    },
  };
}
