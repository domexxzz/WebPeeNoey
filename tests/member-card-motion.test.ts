import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachCardMotion, type CardMotion } from "@/components/marketing/member-card-motion";
import type { CardSide } from "@/lib/paper-card";

/**
 * ทดสอบตัวขับบัตรกระดาษใน Node: ใช้ EventTarget ของ Node แทน DOM, คิว requestAnimationFrame กดเดินเอง,
 * นาฬิกาจำลอง (performance.now + timeStamp ของอีเวนต์) — เหตุการณ์ที่เกิดบนบัตรถูกส่งต่อขึ้น เวที → window เหมือนเบราว์เซอร์
 */

class FakeStyle {
  transform = "";
  private readonly props = new Map<string, string>();
  setProperty(name: string, value: string) {
    this.props.set(name, value);
  }
  getPropertyValue(name: string) {
    return this.props.get(name) ?? "";
  }
}

class FakeElement extends EventTarget {
  style = new FakeStyle();
  offsetWidth = 280;
  offsetHeight = 392;
  failCapture = false;
  private readonly attrs = new Set<string>();
  constructor(private readonly rect = { left: 0, top: 0, width: 360, height: 480 }) {
    super();
  }
  setAttribute(name: string) {
    this.attrs.add(name);
  }
  removeAttribute(name: string) {
    this.attrs.delete(name);
  }
  hasAttribute(name: string) {
    return this.attrs.has(name);
  }
  setPointerCapture() {
    if (this.failCapture) throw new Error("NotFoundError: no active pointer");
  }
  getBoundingClientRect() {
    return this.rect;
  }
}

let now = 0;
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;

class FakePointerEvent extends Event {
  private readonly stamp = now;
  constructor(type: string, init: Record<string, unknown>) {
    super(type);
    Object.assign(this, { pointerId: 1, pointerType: "touch", button: 0, buttons: 1, clientX: 0, clientY: 0, ...init });
  }
  get timeStamp() {
    return this.stamp;
  }
}

let stage: FakeElement;
let card: FakeElement;
let sides: CardSide[];

/** เหตุการณ์ที่เกิดบนบัตร: บัตร → เวที → window */
function onCard(type: string, init: Record<string, unknown> = {}) {
  for (const target of [card, stage, window as unknown as EventTarget]) target.dispatchEvent(new FakePointerEvent(type, init));
}
/** เหตุการณ์นอกบัตร (ปล่อยนิ้ว/เมาส์นอกเวที): window อย่างเดียว */
function onWindow(type: string, init: Record<string, unknown> = {}) {
  (window as unknown as EventTarget).dispatchEvent(new FakePointerEvent(type, init));
}
function onStage(type: string, init: Record<string, unknown> = {}) {
  for (const target of [stage, window as unknown as EventTarget]) target.dispatchEvent(new FakePointerEvent(type, init));
}
function advance(ms: number) {
  now += ms;
}
function runFrames(count = 240, dt = 16) {
  for (let i = 0; i < count && frames.size > 0; i += 1) {
    now += dt;
    const due = [...frames.values()];
    frames.clear();
    due.forEach((callback) => callback(now));
  }
}
const turn = () => Number(/rotateY\((-?[\d.]+)deg\)/.exec(card.style.transform)?.[1]);
const tiltX = () => Number(/rotateX\((-?[\d.]+)deg\)/.exec(card.style.transform)?.[1]);

function attach(options: { reducedMotion?: boolean; finePointer?: boolean } = {}): CardMotion {
  return attachCardMotion(stage as unknown as HTMLElement, card as unknown as HTMLElement, {
    reducedMotion: options.reducedMotion ?? false,
    finePointer: options.finePointer ?? false,
    onSideChange: (side) => sides.push(side),
  });
}

function tap(init: Record<string, unknown> = {}) {
  onCard("pointerdown", init);
  onCard("pointerup", init);
  onCard("click", init);
}

beforeEach(() => {
  now = 1000;
  frames.clear();
  stage = new FakeElement();
  card = new FakeElement();
  sides = [];
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.spyOn(performance, "now").mockImplementation(() => now);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("paper card engine", () => {
  it("flips to the back on a tap, settles exactly on the face and stops asking for frames", () => {
    attach();
    tap();
    expect(sides).toEqual(["back"]);
    runFrames();
    expect(turn()).toBe(180);
    expect(frames.size).toBe(0);
  });

  it("still treats a slightly wobbly finger tap as a tap", () => {
    attach();
    onCard("pointerdown", { clientX: 100, clientY: 100 });
    onCard("pointermove", { clientX: 106, clientY: 104 });
    onCard("pointerup", { clientX: 106, clientY: 104 });
    onCard("click");
    expect(sides).toEqual(["back"]);
  });

  it("does not flip when a tap never becomes a click (e.g. a tap that stops a scroll)", () => {
    attach();
    onCard("pointerdown");
    onCard("pointerup");
    runFrames();
    expect(sides).toEqual([]);
    expect(turn()).toBe(0);
  });

  it("carries a sideways flick over to the other face", () => {
    attach();
    onCard("pointerdown", { clientX: 100 });
    for (let step = 1; step <= 5; step += 1) {
      advance(16);
      onCard("pointermove", { clientX: 100 + step * 30 });
    }
    onCard("pointerup", { clientX: 250 });
    onCard("click");
    runFrames();
    expect(turn()).toBe(180);
    expect(sides.at(-1)).toBe("back");
  });

  it("returns to the same face after a slow drag that pauses before release", () => {
    attach();
    onCard("pointerdown", { clientX: 100 });
    for (let step = 1; step <= 6; step += 1) {
      advance(40);
      onCard("pointermove", { clientX: 100 + step * 10 });
    }
    advance(200);
    onCard("pointerup", { clientX: 160 });
    runFrames();
    expect(turn()).toBe(0);
    expect(sides).toEqual([]);
  });

  it("settles back when the browser takes over for a vertical scroll (pointercancel)", () => {
    attach();
    onCard("pointerdown", { clientY: 100 });
    advance(16);
    onCard("pointermove", { clientY: 130 });
    onCard("pointercancel", { clientY: 130 });
    onCard("click");
    runFrames();
    expect(turn()).toBe(0);
    expect(tiltX()).toBe(0);
    expect(card.hasAttribute("data-dragging")).toBe(false);
    expect(frames.size).toBe(0);
  });

  it("ends a drag whose mouse release was missed (button no longer held) and keeps working afterwards", () => {
    attach();
    onCard("pointerdown", { pointerType: "mouse", clientX: 100 });
    advance(16);
    onCard("pointermove", { pointerType: "mouse", clientX: 140, buttons: 1 });
    advance(16);
    onWindow("pointermove", { pointerType: "mouse", clientX: 150, buttons: 0 });
    expect(card.hasAttribute("data-dragging")).toBe(false);
    runFrames();
    expect(frames.size).toBe(0);
    tap({ pointerType: "mouse" });
    runFrames();
    expect(turn()).toBe(180);
  });

  it("ends the drag when pointer capture is lost or the window loses focus", () => {
    attach();
    onCard("pointerdown", { clientX: 100 });
    advance(16);
    onCard("pointermove", { clientX: 140 });
    card.dispatchEvent(new FakePointerEvent("lostpointercapture", {}));
    expect(card.hasAttribute("data-dragging")).toBe(false);

    onCard("pointerdown", { pointerId: 2, clientX: 100 });
    advance(16);
    onCard("pointermove", { pointerId: 2, clientX: 140 });
    (window as unknown as EventTarget).dispatchEvent(new Event("blur"));
    expect(card.hasAttribute("data-dragging")).toBe(false);
    runFrames();
    expect(frames.size).toBe(0);
  });

  it("still sees the release outside the card when pointer capture fails", () => {
    card.failCapture = true;
    attach();
    onCard("pointerdown", { clientX: 100 });
    advance(16);
    onCard("pointermove", { clientX: 140 });
    onWindow("pointerup", { clientX: 600 });
    expect(card.hasAttribute("data-dragging")).toBe(false);
    runFrames();
    expect(frames.size).toBe(0);
  });

  it("ignores a second finger while the first one is dragging", () => {
    attach();
    onCard("pointerdown", { pointerId: 1, clientX: 100 });
    onCard("pointerdown", { pointerId: 2, clientX: 300 });
    advance(16);
    onCard("pointermove", { pointerId: 2, clientX: 380 });
    runFrames(1);
    expect(turn()).toBe(0);
    onCard("pointerup", { pointerId: 2 });
    expect(card.hasAttribute("data-dragging")).toBe(true);
    onCard("pointerup", { pointerId: 1 });
    expect(card.hasAttribute("data-dragging")).toBe(false);
  });

  it("tilts toward the mouse and lights the spot under it, mirrored on the back face", () => {
    attach({ finePointer: true });
    onStage("pointermove", { pointerType: "mouse", buttons: 0, clientX: 360, clientY: 0 });
    runFrames();
    expect(tiltX()).toBe(10);
    expect(turn()).toBe(14);
    expect(card.hasAttribute("data-lit")).toBe(true);
    expect(card.style.getPropertyValue("--lx")).toBe("160.0px");
    expect(card.style.getPropertyValue("--lx-back")).toBe("-120.0px");
    expect(stage.style.getPropertyValue("--px")).toBe("1");

    stage.dispatchEvent(new FakePointerEvent("pointerleave", { pointerType: "mouse" }));
    runFrames();
    expect(card.hasAttribute("data-lit")).toBe(false);
    expect(tiltX()).toBe(0);
    expect(turn()).toBe(0);
  });

  it("does not tilt on touch screens", () => {
    attach({ finePointer: false });
    onStage("pointermove", { pointerType: "mouse", buttons: 0, clientX: 360, clientY: 0 });
    runFrames();
    expect(card.style.transform).toBe("rotateX(0.00deg) rotateY(0.00deg)");
  });

  it("reduced motion: no hover tilt, no drag rotation, and a tap or drag flips instantly", () => {
    attach({ reducedMotion: true, finePointer: true });
    onStage("pointermove", { pointerType: "mouse", buttons: 0, clientX: 360, clientY: 0 });
    onCard("pointerdown", { clientX: 100 });
    advance(16);
    onCard("pointermove", { clientX: 200 });
    expect(turn()).toBe(0);
    expect(card.hasAttribute("data-dragging")).toBe(false);
    onCard("pointerup", { clientX: 200 });
    onCard("click");
    expect(turn()).toBe(180);
    expect(sides).toEqual(["back"]);
  });

  it("flip() from the button turns to the other face each time", () => {
    const engine = attach();
    engine.flip();
    runFrames();
    expect(turn()).toBe(180);
    engine.flip();
    runFrames();
    expect(turn()).toBe(360);
    expect(sides).toEqual(["back", "front"]);
  });

  it("destroy() cancels the pending frame and stops listening", () => {
    const engine = attach();
    engine.flip();
    expect(frames.size).toBe(1);
    engine.destroy();
    expect(frames.size).toBe(0);
    tap();
    runFrames();
    expect(sides).toEqual(["back"]);
  });
});
