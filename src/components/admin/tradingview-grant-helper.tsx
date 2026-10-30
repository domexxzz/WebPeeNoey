"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, TriangleAlert } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { tradingViewProfileUrl } from "@/lib/admin/tradingview-access";

interface TradingViewGrantHelperProps {
  username: string | null;
  /** วันสิ้นสุดสิทธิ์ — ใส่เป็นวันหมดอายุตอนเพิ่มชื่อใน TradingView แล้วระบบของ TradingView ตัดสิทธิ์ให้เอง */
  periodEnd: Date;
  scriptAccessUrl: string | null;
}

/** ตัวช่วยตอนเปิดสิทธิ์อินดิเคเตอร์: คัดลอกชื่อผู้ใช้ เปิดโปรไฟล์เช็กว่ามีจริง และเปิดหน้าจัดการสิทธิ์ของสคริปต์ */
export function TradingViewGrantHelper({ username, periodEnd, scriptAccessUrl }: TradingViewGrantHelperProps) {
  const [copied, setCopied] = useState(false);
  const name = username?.trim() ?? "";
  const profileUrl = tradingViewProfileUrl(name);

  const copyUsername = async () => {
    try {
      await navigator.clipboard.writeText(name);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // คัดลอกไม่ได้ (เบราว์เซอร์ไม่อนุญาต) — ชื่อยังอยู่บนหน้าจอให้เลือกเองได้
    }
  };

  if (!name) {
    return (
      <p className="mt-2 flex items-start gap-1.5 text-xs text-orange-700">
        <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        สมาชิกยังไม่ได้กรอก TradingView Username — เปิดสิทธิ์ไม่ได้จนกว่าจะได้ชื่อผู้ใช้
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-1.5 border-t border-line-soft pt-2 text-xs">
      <div className="flex items-center gap-1.5">
        <code className="min-w-0 flex-1 truncate font-mono text-fg" title={name}>
          {name}
        </code>
        <button
          type="button"
          onClick={copyUsername}
          className="inline-flex shrink-0 items-center gap-1 border border-line px-2 py-1 text-fg-muted transition-colors hover:border-gold hover:text-gold-ink rounded-lg"
        >
          {copied ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
          {copied ? "คัดลอกแล้ว" : "คัดลอกชื่อ"}
        </button>
      </div>
      <p className="text-fg-subtle">
        ใส่วันหมดอายุใน TradingView เป็น <span className="text-fg">{formatDateTime(periodEnd)}</span> เพื่อให้ตัดสิทธิ์เองเมื่อครบกำหนด
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {profileUrl && (
          <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-gold-ink hover:underline">
            เปิดโปรไฟล์เช็กชื่อ <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        )}
        {scriptAccessUrl && (
          <a href={scriptAccessUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-gold-ink hover:underline">
            หน้าสคริปต์ → จัดการการเข้าถึง <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        )}
      </div>
      <p className="text-fg-subtle">ติ๊กปุ่มด้านบนหลังเพิ่มชื่อใน TradingView แล้วเท่านั้น — ปุ่มนี้เป็นแค่การบันทึก ไม่ได้เปิดสิทธิ์ให้เอง</p>
    </div>
  );
}
