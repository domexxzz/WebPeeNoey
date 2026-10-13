"use client";

import { useEffect, useRef, useState } from "react";
import { HERO_CONTENT, TRADINGVIEW_CHART } from "@/config/marketing";
import { HeroChart } from "./hero-chart";

type Status = "waiting" | "loading" | "ready" | "failed";

/** โหลดไม่เสร็จในเวลานี้ (เช่นเน็ตช้า/ถูกบล็อก) → คงภาพวาดไว้ ไม่ให้ช่องว่างค้าง */
const LOAD_TIMEOUT_MS = 15_000;

/**
 * กราฟราคาจริงแบบสดจาก TradingView (widget ทางการ) ใน hero
 * - โหลดสคริปต์ของ TradingView หลังหน้าโหลดเสร็จ + เห็นบนจอ + เบราว์เซอร์ว่าง → ไม่ถ่วง LCP
 * - ระหว่างรอ/โหลดไม่ได้ แสดงกราฟวาด (HeroChart) และคำบรรยายว่าเป็นภาพประกอบ — โหลดสำเร็จแล้วค่อยสลับ
 * - คงลิงก์ระบุที่มา TradingView ไว้ตามเงื่อนไขการฝัง widget
 * - อุปกรณ์จอสัมผัส: ปิดการลาก/ซูมในกราฟ ไม่ให้แย่งการเลื่อนหน้า
 * decorations = ชิ้นตกแต่งที่ลอยรอบกราฟ (ส่งมาจาก server component)
 */
export function LiveChart({ decorations }: { decorations?: React.ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("waiting");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let mutation: MutationObserver | undefined;
    let timeout = 0;
    let idle = 0;

    const fail = () => {
      if (!cancelled) setStatus((current) => (current === "ready" ? current : "failed"));
    };

    const inject = () => {
      if (cancelled || host.querySelector("script")) return;
      setStatus("loading");
      mutation = new MutationObserver(() => {
        const iframe = host.querySelector("iframe");
        if (!iframe) return;
        mutation?.disconnect();
        iframe.title = "กราฟราคาจาก TradingView";
        iframe.addEventListener("load", () => !cancelled && setStatus("ready"), { once: true });
      });
      mutation.observe(host, { childList: true, subtree: true });

      const script = document.createElement("script");
      script.src = TRADINGVIEW_CHART.scriptSrc;
      script.async = true;
      script.type = "text/javascript";
      // สคริปต์ของ TradingView อ่านค่าตั้งจากเนื้อหาของแท็กตัวเอง (ค่าคงที่ของเรา ไม่มีข้อมูลจากผู้ใช้)
      script.text = JSON.stringify(TRADINGVIEW_CHART.config);
      script.onerror = fail;
      host.appendChild(script);
      timeout = window.setTimeout(fail, LOAD_TIMEOUT_MS);
    };

    const whenIdle = () => {
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(inject, { timeout: 2000 });
      else idle = window.setTimeout(inject, 300);
    };
    const afterPageLoad = () => {
      if (document.readyState === "complete") whenIdle();
      else window.addEventListener("load", whenIdle, { once: true });
    };
    const visibility = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        visibility.disconnect();
        afterPageLoad();
      },
      { rootMargin: "200px" },
    );
    visibility.observe(host);

    return () => {
      cancelled = true;
      visibility.disconnect();
      mutation?.disconnect();
      window.removeEventListener("load", whenIdle);
      window.clearTimeout(timeout);
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      window.clearTimeout(idle);
    };
  }, []);

  const ready = status === "ready";
  return (
    <>
      <div className="mx-load-zoom" style={{ "--load-delay": "250ms" } as React.CSSProperties}>
        <div className="relative">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-ink-deep ring-1 ring-line sm:aspect-[16/10]">
            <div aria-hidden="true" className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`}>
              <HeroChart animated className="h-full w-full" />
            </div>
            <div
              ref={hostRef}
              className={`tradingview-widget-container absolute inset-0 transition-opacity duration-700 [@media(pointer:coarse)]:pointer-events-none ${
                ready ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <div className="tradingview-widget-container__widget h-full w-full" />
            </div>
          </div>
          {decorations}
        </div>
      </div>
      <figcaption className="mx-load text-xs leading-relaxed text-gray-400 sm:pl-2" style={{ "--load-delay": "1200ms" } as React.CSSProperties}>
        {ready ? (
          <>
            {HERO_CONTENT.liveChartCaption} ·{" "}
            <a
              href={TRADINGVIEW_CHART.attributionHref}
              target="_blank"
              rel="noopener nofollow"
              className="text-signal underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
            >
              Track all markets on TradingView
            </a>
          </>
        ) : (
          HERO_CONTENT.visualCaption
        )}
      </figcaption>
    </>
  );
}
