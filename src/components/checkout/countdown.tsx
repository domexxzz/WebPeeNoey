"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const TICK_MS = 1000;
const REFRESH_RETRY_MS = 5000;
const MAX_REFRESH_ATTEMPTS = 3;

export function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** เวลาที่เหลือตามนาฬิกาเซิร์ฟเวอร์ (ชดเชยกรณีนาฬิกาเครื่องผู้ใช้เร็วหรือช้า) */
export function remainingMs(deadlineMs: number, clientNowMs: number, clockOffsetMs: number): number {
  return deadlineMs - (clientNowMs + clockOffsetMs);
}

/**
 * นับถอยหลังถึงเวลาที่กำหนด แล้วรีเฟรชหน้าเพื่อให้ server แสดงสถานะใหม่
 * ใช้เวลาของเซิร์ฟเวอร์เป็นหลัก และลองรีเฟรชซ้ำเผื่อสถานะยังไม่เปลี่ยน
 */
export function Countdown({ deadline, serverNow }: { deadline: string; serverNow: string }) {
  const router = useRouter();
  // คำนวณหลัง mount เท่านั้น เพื่อไม่ให้ HTML จาก server กับ client ไม่ตรงกัน (hydration mismatch)
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const deadlineMs = new Date(deadline).getTime();
    const clockOffsetMs = new Date(serverNow).getTime() - Date.now();
    let refreshes = 0;
    let lastRefreshAt = 0;

    const tick = () => {
      const left = remainingMs(deadlineMs, Date.now(), clockOffsetMs);
      setRemaining(left);
      const canRetry = refreshes < MAX_REFRESH_ATTEMPTS && Date.now() - lastRefreshAt >= REFRESH_RETRY_MS;
      if (left <= 0 && canRetry) {
        refreshes += 1;
        lastRefreshAt = Date.now();
        router.refresh();
      }
    };
    const timer = setInterval(tick, TICK_MS);
    tick();
    return () => clearInterval(timer);
  }, [deadline, serverNow, router]);

  return (
    <span role="timer" aria-live="off" className="font-heading tabular-nums">
      {remaining === null ? "--:--" : formatRemaining(remaining)}
    </span>
  );
}
