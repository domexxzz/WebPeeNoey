"use client";

import { useEffect } from "react";
import { LOOP_SELECTOR, REVEAL_SELECTOR, collectTargets, pointerRatio, scrollState, startedAfterFailsafe } from "@/lib/motion";

/**
 * ตัวขับอนิเมชันหน้าบ้านตัวเดียวทั้งหน้า (ไม่ render อะไร):
 * - [data-reveal] → ใส่ data-inview เมื่อเลื่อนมาถึง หรือเมื่อโฟกัสคีย์บอร์ดเข้าไป
 * - [data-loop] → data-offscreen เมื่ออยู่นอกจอ (CSS หยุดอนิเมชันวนไว้ ประหยัดแบตเตอรี่)
 * - [data-tilt] / [data-magnetic] / [data-spotlight] → ตั้ง --px/--py/--spot-x/--spot-y ตามเมาส์ (เฉพาะอุปกรณ์ที่มีเมาส์)
 * - แถบความคืบหน้า (.mx-progress) + header ซ่อน/โผล่ (html[data-header-hidden]) — โฟกัสเข้า header แล้วโผล่เสมอ
 * ผู้ใช้ที่ตั้งค่าลดการเคลื่อนไหว: เผยทุกอย่างทันที ไม่มีเอฟเฟกต์เมาส์
 */
const POINTER_SELECTORS = ["[data-tilt]", "[data-magnetic]", "[data-spotlight]"] as const;

const markInView = (element: Element) => element.setAttribute("data-inview", "");

function watchAdded(selector: string, onFound: (elements: Element[]) => void): () => void {
  onFound(Array.from(document.querySelectorAll(selector)));
  // เปลี่ยนหน้าแบบ client-side: ตรวจเฉพาะโหนดที่เพิ่งแทรก ไม่สแกนทั้งหน้าซ้ำ
  const mutations = new MutationObserver((records) => {
    const added = collectTargets<Element>(
      records.flatMap((record) => Array.from(record.addedNodes)),
      selector,
    );
    if (added.length > 0) onFound(added);
  });
  mutations.observe(document.body, { childList: true, subtree: true });
  return () => mutations.disconnect();
}

function startReveal(): () => void {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        markInView(entry.target);
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.1 },
  );
  const stopWatching = watchAdded(REVEAL_SELECTOR, (elements) => elements.forEach((element) => observer.observe(element)));
  return () => {
    stopWatching();
    observer.disconnect();
  };
}

function startLoopPausing(): () => void {
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((entry) => entry.target.toggleAttribute("data-offscreen", !entry.isIntersecting)),
    { rootMargin: "120px 0px" },
  );
  const stopWatching = watchAdded(LOOP_SELECTOR, (elements) => elements.forEach((element) => observer.observe(element)));
  return () => {
    stopWatching();
    observer.disconnect();
  };
}

function resetPointer(element: HTMLElement) {
  element.removeAttribute("data-pointer-active");
  element.style.setProperty("--px", "0");
  element.style.setProperty("--py", "0");
}

function startPointerEffects(): () => void {
  const active = new Map<string, HTMLElement>();
  // วัดขนาดครั้งเดียวตอนเริ่มชี้ (กล่องที่เอียง/ขยับอยู่จะวัดได้เพี้ยนและสั่นที่ขอบ) — ล้างเมื่อเลื่อน/ย่อขยายจอ
  const boxes = new WeakMap<HTMLElement, DOMRect>();
  let pending: PointerEvent | null = null;
  let frame = 0;

  const apply = () => {
    frame = 0;
    const event = pending;
    pending = null;
    if (!event) return;
    const target = event.target instanceof Element ? event.target : null;
    for (const selector of POINTER_SELECTORS) {
      const element = target?.closest<HTMLElement>(selector) ?? null;
      const previous = active.get(selector);
      if (previous && previous !== element) resetPointer(previous);
      if (!element) {
        active.delete(selector);
        continue;
      }
      active.set(selector, element);
      let box = boxes.get(element);
      if (!box) {
        box = element.getBoundingClientRect();
        boxes.set(element, box);
      }
      const { px, py, x, y } = pointerRatio(box, event.clientX, event.clientY);
      element.setAttribute("data-pointer-active", "");
      element.style.setProperty("--px", String(px));
      element.style.setProperty("--py", String(py));
      element.style.setProperty("--spot-x", `${x}px`);
      element.style.setProperty("--spot-y", `${y}px`);
    }
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    pending = event;
    if (!frame) frame = requestAnimationFrame(apply);
  };
  const onLeave = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    pending = null;
    active.forEach(resetPointer);
    active.clear();
  };
  const onLayoutChange = () => {
    active.forEach((element) => boxes.delete(element));
  };

  document.addEventListener("pointermove", onMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  window.addEventListener("scroll", onLayoutChange, { passive: true });
  window.addEventListener("resize", onLayoutChange, { passive: true });
  return () => {
    document.removeEventListener("pointermove", onMove);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("scroll", onLayoutChange);
    window.removeEventListener("resize", onLayoutChange);
    onLeave();
  };
}

function startScrollState(): () => void {
  const root = document.documentElement;
  let previousY = window.scrollY;
  let frame = 0;

  const update = () => {
    frame = 0;
    const header = document.querySelector("[data-site-header]");
    const state = scrollState({
      y: window.scrollY,
      previousY,
      scrollHeight: root.scrollHeight,
      viewportHeight: window.innerHeight,
      keepHeaderVisible: Boolean(header?.matches(":focus-within") || header?.querySelector('[aria-expanded="true"]')),
      headerHidden: root.hasAttribute("data-header-hidden"),
    });
    previousY = state.previousY;
    // ตั้งตัวแปรที่แถบเอง ไม่ใช่ที่ <html> — ตัวแปรบน root ทำให้ทั้งหน้าคำนวณสไตล์ใหม่ทุกเฟรม
    document.querySelector<HTMLElement>(".mx-progress")?.style.setProperty("--scroll", state.progress.toFixed(4));
    root.toggleAttribute("data-scrolled", state.scrolled);
    root.toggleAttribute("data-header-hidden", state.headerHidden);
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  // คีย์บอร์ด: Tab เข้า header ที่ซ่อนอยู่ต้องโผล่ทันที (หน้าไม่เลื่อน จึงไม่มี scroll event มาช่วย)
  const onFocusIn = (event: FocusEvent) => {
    if (event.target instanceof Element && event.target.closest("[data-site-header]")) root.removeAttribute("data-header-hidden");
  };

  update();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  document.addEventListener("focusin", onFocusIn);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    document.removeEventListener("focusin", onFocusIn);
    root.removeAttribute("data-header-hidden");
    root.removeAttribute("data-scrolled");
  };
}

/** โฟกัสคีย์บอร์ดเข้าไปในชิ้นที่ยังไม่เผย (เช่นอยู่ขอบล่างจอ) → เผยทันที ไม่ให้โฟกัสอยู่บนของที่มองไม่เห็น */
function revealOnFocus(): () => void {
  const onFocusIn = (event: FocusEvent) => {
    if (!(event.target instanceof Element)) return;
    for (let node = event.target.closest(REVEAL_SELECTOR); node; node = node.parentElement?.closest(REVEAL_SELECTOR) ?? null) {
      markInView(node);
    }
  };
  document.addEventListener("focusin", onFocusIn);
  return () => document.removeEventListener("focusin", onFocusIn);
}

export function MotionRuntime() {
  useEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    const stops = [startScrollState(), revealOnFocus()];
    if (reducedMotion || startedAfterFailsafe(performance.now())) {
      // ลดการเคลื่อนไหว หรือเครื่องช้าจน CSS กันพลาดแสดงทุกอย่างไปแล้ว → เผยทั้งหมดทันที (รวมหน้าที่เปลี่ยนเข้ามาทีหลัง)
      stops.push(watchAdded(REVEAL_SELECTOR, (elements) => elements.forEach(markInView)));
    } else {
      stops.push(startReveal());
    }
    if (!reducedMotion) {
      stops.push(startLoopPausing());
      if (finePointer) stops.push(startPointerEffects());
    }
    root.setAttribute("data-motion", "ready");

    return () => {
      stops.forEach((stop) => stop());
      root.removeAttribute("data-motion");
    };
  }, []);

  return null;
}
