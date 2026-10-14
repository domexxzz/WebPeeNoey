"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { MOTION_PREFERENCE_KEY, readMotionPaused } from "@/lib/motion";

/**
 * ปุ่มหยุด/เล่นภาพเคลื่อนไหวที่วนต่อเนื่อง (WCAG 2.2.2 — ภาพเคลื่อนไหวที่เล่นเองนานกว่า 5 วินาทีต้องหยุดได้)
 * จำค่าไว้ในเบราว์เซอร์ (localStorage) — อ่าน/เขียนไม่ได้ก็ใช้งานต่อได้ตามปกติ
 * หยุดเฉพาะอนิเมชันวน ส่วนการเผยเนื้อหาตอนเลื่อนยังทำงาน (ไม่มีเนื้อหาค้างซ่อน)
 */
export function MotionToggle() {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setPaused(readMotionPaused(() => window.localStorage.getItem(MOTION_PREFERENCE_KEY)));
  }, []);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-motion-paused", paused);
  }, [paused]);

  const toggle = () => {
    const next = !paused;
    setPaused(next);
    try {
      if (next) window.localStorage.setItem(MOTION_PREFERENCE_KEY, "paused");
      else window.localStorage.removeItem(MOTION_PREFERENCE_KEY);
    } catch {
      // โหมดส่วนตัว/บล็อกที่เก็บข้อมูล: หยุดได้เฉพาะหน้านี้ ไม่จำค่า
    }
  };

  const label = paused ? "เล่นภาพเคลื่อนไหว" : "หยุดภาพเคลื่อนไหว";
  const Icon = paused ? Play : Pause;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={paused}
      aria-label={label}
      title={label}
      className="mx-toggle fixed bottom-4 left-4 z-[60] flex w-10 h-10 items-center justify-center border border-line bg-surface/90 text-fg backdrop-blur transition-colors hover:border-gold hover:text-gold-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-ink motion-reduce:hidden rounded-xl"
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
    </button>
  );
}
