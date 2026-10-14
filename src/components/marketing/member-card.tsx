"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Check, RotateCw } from "lucide-react";
import { MEMBER_CARD } from "@/config/marketing";
import { siteConfig } from "@/config/site";
import { sealFontSize, type CardSide } from "@/lib/paper-card";
import { attachCardMotion, type CardMotion } from "./member-card-motion";

/**
 * บัตรสมาชิกกระดาษ 3 มิติ (CSS 3D ไม่ใช้ WebGL) — เอียงตามเมาส์, จับลากหมุนได้, ปล่อยแล้วหยุดที่ด้านใกล้สุด
 * ด้านหน้า = แบรนด์ / ด้านหลัง = สิทธิ์จากแพ็กเกจจริง (MEMBER_CARD) — ด้านที่หันหนีถูกซ่อนจากโปรแกรมอ่านหน้าจอ
 * ปุ่ม "พลิก" ใช้ได้กับคีย์บอร์ดและจอสัมผัส; การเคลื่อนไหวทั้งหมดอยู่ใน member-card-motion.ts + paper-card.css
 */
const MONOGRAM = siteConfig.name
  .split(/\s+/)
  .map((word) => word.charAt(0))
  .join("")
  .toUpperCase();
const SEAL_TEXT = `${siteConfig.name.toUpperCase()} · ${MEMBER_CARD.kicker} · `;
/** วงตัวอักษรตราประทับรัศมี 38 — ข้อความกระจายเต็มวง และย่อ/ขยายตัวอักษรตามความยาวชื่อแบรนด์ */
const SEAL_CIRCUMFERENCE = Math.round(2 * Math.PI * 38 * 100) / 100;
const SEAL_FONT_SIZE = Math.round(sealFontSize(SEAL_TEXT.length, SEAL_CIRCUMFERENCE) * 100) / 100;

const depth = (value: number) => ({ "--depth": value }) as CSSProperties;

function Seal() {
  const pathId = `seal-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div aria-hidden="true" className="pc-seal">
      <svg viewBox="0 0 100 100" className="pc-seal-ring">
        <defs>
          <path id={pathId} d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
        </defs>
        <text fontSize={SEAL_FONT_SIZE}>
          <textPath href={`#${pathId}`} textLength={SEAL_CIRCUMFERENCE}>
            {SEAL_TEXT}
          </textPath>
        </text>
      </svg>
      <span className="pc-seal-core font-display">{MONOGRAM}</span>
    </div>
  );
}

/** ชั้นแสงเงาของกระดาษ: เงาขอบตอนหันข้าง, แถบแสงสะท้อน, วงแสงใต้เมาส์ (ขยับด้วย opacity/translate เท่านั้น) */
function PaperLayers() {
  return (
    <>
      <span aria-hidden="true" className="pc-shade" />
      <span aria-hidden="true" className="pc-sheen" />
      <span aria-hidden="true" className="pc-light" />
    </>
  );
}

function CardFront({ hidden }: { hidden: boolean }) {
  return (
    <div data-face="front" aria-hidden={hidden || undefined} className="pc-face">
      <PaperLayers />
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 whitespace-nowrap font-display text-sm font-bold text-fg">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[30%] bg-gold" />
          {siteConfig.name}
        </span>
        <span aria-hidden="true" className="pc-foil" />
      </div>
      <Seal />
      <div className="mt-auto">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-gold-ink">{MEMBER_CARD.kicker}</p>
        <p className="mt-1 font-display text-3xl font-bold tracking-tight text-fg">{MEMBER_CARD.label}</p>
        <p className="mt-1 text-xs text-fg-muted">{MEMBER_CARD.tagline}</p>
        <div aria-hidden="true" className="pc-perforation my-4" />
        <ul className="flex flex-wrap gap-1">
          {MEMBER_CARD.channels.map((channel) => (
            <li key={channel} className="rounded-full border border-gold/50 bg-gold-muted px-2.5 py-1 text-[11px] font-semibold text-gold-ink">
              {channel}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CardBack({ hidden }: { hidden: boolean }) {
  return (
    <div data-face="back" aria-hidden={hidden || undefined} className="pc-face pc-face-back">
      <PaperLayers />
      <p className="text-[11px] font-semibold tracking-[0.18em] text-gold-ink">{MEMBER_CARD.kicker}</p>
      <p className="mt-2 font-display text-lg font-bold leading-snug text-fg">{MEMBER_CARD.perksTitle}</p>
      <ul className="mt-4 space-y-2.5">
        {MEMBER_CARD.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2 text-[13px] leading-snug text-fg-muted">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-ink" aria-hidden="true" />
            <span>{perk}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto">
        <div aria-hidden="true" className="pc-perforation mb-3" />
        <p className="text-[11px] leading-relaxed text-fg-subtle">{MEMBER_CARD.footnote}</p>
      </div>
    </div>
  );
}

export function MemberCard() {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const motion = useRef<CardMotion | null>(null);
  const [side, setSide] = useState<CardSide>("front");
  const [announcement, setAnnouncement] = useState("");
  const cardId = `member-card-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    const stage = stageRef.current;
    const card = cardRef.current;
    if (!stage || !card) return;
    const engine = attachCardMotion(stage, card, {
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      finePointer: window.matchMedia("(hover: hover) and (pointer: fine)").matches,
      onSideChange: (next) => {
        setSide(next);
        setAnnouncement(next === "back" ? `ด้านหลังบัตร: ${MEMBER_CARD.perksTitle}` : `ด้านหน้าบัตร: ${MEMBER_CARD.label}`);
      },
    });
    motion.current = engine;
    return () => {
      engine.destroy();
      motion.current = null;
    };
  }, []);

  const showingBack = side === "back";
  return (
    <div data-member-card="" className="flex flex-col items-center gap-3">
      <div ref={stageRef} data-loop="" className="pc-stage">
        <span aria-hidden="true" data-depth="" style={depth(-10)} className="pc-word font-display">
          GOLD
        </span>
        <span aria-hidden="true" data-depth="" style={depth(16)} className="pc-halo" />
        <div className="pc-float mx-float-slow">
          <div ref={cardRef} id={cardId} role="group" aria-label={`${MEMBER_CARD.label} ${siteConfig.name}`} className="pc-card">
            <CardFront hidden={showingBack} />
            <CardBack hidden={!showingBack} />
          </div>
        </div>
      </div>
      <button
        type="button"
        aria-controls={cardId}
        onClick={() => motion.current?.flip()}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-fg transition-colors hover:border-gold hover:bg-gold-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-ink"
      >
        <RotateCw className="h-4 w-4 text-gold-ink" aria-hidden="true" />
        {showingBack ? MEMBER_CARD.flipToFront : MEMBER_CARD.flipToBack}
      </button>
      <p aria-hidden="true" className="text-xs text-fg-subtle">
        {MEMBER_CARD.hint}
      </p>
      <p aria-live="polite" className="sr-only">{announcement}</p>
    </div>
  );
}
