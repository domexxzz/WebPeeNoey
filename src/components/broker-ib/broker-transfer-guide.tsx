"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightLeft, Check, ChevronDown, Copy, ExternalLink, ImageIcon, MessageCircle, X } from "lucide-react";
import { BROKER_PARTNER_CODES, BROKER_TRANSFER_GUIDE } from "@/config/broker-ib";

export function BrokerTransferGuide({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [showSteps, setShowSteps] = useState(defaultOpen);
  const [selectedBroker, setSelectedBroker] = useState<"XM" | "EXNESS">("XM");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const activeItem = BROKER_TRANSFER_GUIDE.brokers.find((b) => b.broker === selectedBroker) ?? BROKER_TRANSFER_GUIDE.brokers[0];

  const handleCopy = async (code: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedCode(code);
      setTimeout(() => {
        setCopiedCode(null);
      }, 2000);
    } catch {
      // Ignore copy error
    }
  };

  // Close image modal with Escape key
  useEffect(() => {
    if (!isImageModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsImageModalOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isImageModalOpen]);

  return (
    <div className="border border-gold/40 bg-surface rounded-2xl overflow-hidden transition-all shadow-sm">
      {/* Header bar */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-gold/10 via-gold/5 to-transparent border-b border-line-soft">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-gold/20 text-gold-ink shrink-0 mt-0.5">
            <ArrowRightLeft className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-display text-base sm:text-lg font-bold text-fg">
              {BROKER_TRANSFER_GUIDE.title}
            </h3>
            <p className="mt-0.5 text-xs sm:text-sm text-fg-muted">
              ใส่รหัสพาร์ทเนอร์ XM ({BROKER_PARTNER_CODES.XM}) หรือ Exness ({BROKER_PARTNER_CODES.EXNESS}) เพื่อเปิดบัญชีเทรดเพิ่มเติมหรือย้ายสายงาน
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowSteps(!showSteps)}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto bg-surface hover:bg-surface-sunken border border-line px-3 py-1.5 text-xs font-semibold text-fg transition-colors rounded-xl shrink-0"
          aria-expanded={showSteps}
          aria-controls="transfer-guide-steps"
        >
          {showSteps ? "ซ่อนขั้นตอนข้อความ" : "ดูขั้นตอนข้อความ"}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showSteps ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>

      {/* Quick Partner Codes Bar */}
      <div className="p-4 sm:px-5 py-3 bg-surface-sunken/50 border-b border-line-soft flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <span className="font-semibold text-fg">รหัสพันธมิตร:</span>
          <div className="flex items-center gap-2">
            <span className="text-fg-muted">XM:</span>
            <span className="font-mono font-bold text-gold-ink bg-surface px-2 py-0.5 rounded border border-gold/30 select-all">
              {BROKER_PARTNER_CODES.XM}
            </span>
            <button
              type="button"
              onClick={() => handleCopy(BROKER_PARTNER_CODES.XM)}
              className="p-1 text-fg-muted hover:text-gold-ink transition-colors"
              title="คัดลอกรหัส XM"
              aria-label="คัดลอกรหัส XM"
            >
              {copiedCode === BROKER_PARTNER_CODES.XM ? <Check className="w-3.5 h-3.5 text-accent-green" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <span className="text-line-strong hidden sm:inline">|</span>
          <div className="flex items-center gap-2">
            <span className="text-fg-muted">Exness:</span>
            <span className="font-mono font-bold text-gold-ink bg-surface px-2 py-0.5 rounded border border-gold/30 select-all">
              {BROKER_PARTNER_CODES.EXNESS}
            </span>
            <button
              type="button"
              onClick={() => handleCopy(BROKER_PARTNER_CODES.EXNESS)}
              className="p-1 text-fg-muted hover:text-gold-ink transition-colors"
              title="คัดลอกรหัส Exness"
              aria-label="คัดลอกรหัส Exness"
            >
              {copiedCode === BROKER_PARTNER_CODES.EXNESS ? <Check className="w-3.5 h-3.5 text-accent-green" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {copiedCode && (
          <span className="text-accent-green font-medium flex items-center gap-1 animate-fadeIn">
            <Check className="w-3.5 h-3.5" /> คัดลอกรหัสแล้ว!
          </span>
        )}
      </div>

      {/* Image Displayed Directly Inline! */}
      <div className="p-4 sm:p-5">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsImageModalOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsImageModalOpen(true);
            }
          }}
          aria-label="ดูรูปภาพคู่มือ (แตะเพื่อขยายเต็มจอ)"
          className="group relative block overflow-hidden rounded-xl border border-line bg-surface-sunken hover:border-gold/60 transition-all cursor-zoom-in shadow-sm"
        >
          <Image
            src={BROKER_TRANSFER_GUIDE.image.src}
            alt={BROKER_TRANSFER_GUIDE.image.alt}
            width={BROKER_TRANSFER_GUIDE.image.width}
            height={BROKER_TRANSFER_GUIDE.image.height}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 480px"
            priority
            className="w-full h-auto object-contain transition-transform duration-200 group-hover:scale-[1.01]"
          />
          <div className="absolute bottom-2.5 right-2.5 bg-black/75 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-md">
            <ImageIcon className="w-3.5 h-3.5 text-gold" aria-hidden="true" />
            <span>ดูรูปภาพคู่มือ (แตะเพื่อขยาย)</span>
          </div>
        </div>
      </div>

      {/* Optional Step-by-Step Text (Expandable) */}
      {showSteps && (
        <div id="transfer-guide-steps" className="px-4 sm:px-6 pb-6 pt-1 border-t border-line-soft space-y-4 animate-fadeIn">
          {/* Broker Tabs */}
          <div className="flex flex-wrap items-center gap-2 pt-3" role="tablist" aria-label="เลือกโบรกเกอร์ที่ต้องการย้ายสายงาน">
            {BROKER_TRANSFER_GUIDE.brokers.map((item) => {
              const isSelected = selectedBroker === item.broker;
              return (
                <button
                  key={item.broker}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedBroker(item.broker)}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                    isSelected
                      ? "bg-gold text-fg shadow-sm"
                      : "bg-surface-sunken border border-line text-fg-muted hover:text-fg hover:border-gold/50"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.tag && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                      isSelected ? "bg-black/15 text-fg" : "bg-gold/20 text-gold-ink"
                    }`}>
                      {item.tag}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Broker Content */}
          <div className="bg-surface-sunken/60 border border-line rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface border border-gold/30 p-4 rounded-xl">
              <div>
                <span className="text-xs font-medium text-fg-muted">
                  รหัสพันธมิตรสำหรับ{activeItem.label} (Partner Code):
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-xl sm:text-2xl font-bold tracking-wider text-gold-ink select-all">
                    {activeItem.partnerCode}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(activeItem.partnerCode)}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                  copiedCode === activeItem.partnerCode
                    ? "bg-accent-green text-white"
                    : "bg-gold hover:bg-gold-hover text-fg"
                }`}
              >
                {copiedCode === activeItem.partnerCode ? (
                  <>
                    <Check className="w-4 h-4" aria-hidden="true" />
                    คัดลอกรหัสแล้ว!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" aria-hidden="true" />
                    คัดลอกรหัส {activeItem.partnerCode}
                  </>
                )}
              </button>
            </div>

            <div>
              <p className="text-xs font-semibold text-fg mb-3">ขั้นตอนดำเนินการ:</p>
              <ol className="space-y-2.5">
                {activeItem.steps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-fg leading-relaxed">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold/20 font-display text-xs font-bold text-gold-ink mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {activeItem.note && (
              <p className="text-xs text-fg-muted pt-2 border-t border-line-soft">
                💡 <span className="font-medium text-fg">หมายเหตุ:</span> {activeItem.note}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Footer Support link */}
      <div className="px-4 sm:px-5 py-3 border-t border-line-soft bg-surface-sunken/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-fg-muted">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-gold-ink shrink-0" aria-hidden="true" />
          <span>{BROKER_TRANSFER_GUIDE.supportNote}</span>
        </div>
        <Link
          href="/#contact"
          className="text-gold-ink underline underline-offset-4 hover:text-gold-hover font-semibold inline-flex items-center gap-1 self-start sm:self-auto shrink-0"
        >
          ติดต่อทีมงาน <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </Link>
      </div>

      {/* Lightbox / Modal for Image Zoom */}
      {isImageModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="รูปภาพคู่มือเปรียบเทียบโบรกเกอร์และการย้ายสายงาน"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div
            className="relative max-h-[94vh] max-w-lg w-full bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-gold-ink" aria-hidden="true" />
                <span className="font-display text-sm font-bold text-fg">คู่มือและการเปรียบเทียบโบรกเกอร์</span>
              </div>
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="p-1 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-sunken transition-colors"
                aria-label="ปิดหน้าต่างรูปภาพ"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-2 sm:p-4 bg-black/5 flex items-center justify-center">
              <Image
                src={BROKER_TRANSFER_GUIDE.image.src}
                alt={BROKER_TRANSFER_GUIDE.image.alt}
                width={BROKER_TRANSFER_GUIDE.image.width}
                height={BROKER_TRANSFER_GUIDE.image.height}
                sizes="100vw"
                className="w-full h-auto rounded-xl shadow-md border border-line object-contain"
              />
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 border-t border-line bg-surface flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-fg-muted">
                XM: <strong className="font-mono text-gold-ink select-all">YKMDC</strong> · Exness: <strong className="font-mono text-gold-ink select-all">00awo0516g</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="bg-gold px-4 py-1.5 text-xs font-semibold text-fg rounded-lg hover:bg-gold-hover transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
