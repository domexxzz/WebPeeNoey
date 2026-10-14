import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  dragTiltX,
  dragTurn,
  edgeShade,
  flipTarget,
  hoverTilt,
  isSettled,
  lightOffset,
  nearestTurn,
  releaseTarget,
  sealFontSize,
  sheenOffset,
  sheenTranslate,
  sideAt,
  stepSpring,
  tapSlop,
  trackVelocity,
  type Spring,
} from "@/lib/paper-card";
import { MemberCard } from "@/components/marketing/member-card";
import { PricingSection } from "@/components/marketing/pricing-section";
import { MEMBER_CARD } from "@/config/marketing";
import { SITE_PLANS } from "@/config/plans";
import { siteConfig } from "@/config/site";

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null, status: "unauthenticated" }) }));

describe("paper card physics", () => {
  it("snaps any angle to the nearest face (multiples of 180°)", () => {
    expect(nearestTurn(0)).toBe(0);
    expect(nearestTurn(89)).toBe(0);
    expect(nearestTurn(91)).toBe(180);
    expect(nearestTurn(-100)).toBe(-180);
    expect(nearestTurn(430)).toBe(360);
    expect(nearestTurn(500)).toBe(540);
  });

  it("knows which side faces the viewer at any angle", () => {
    expect(sideAt(0)).toBe("front");
    expect(sideAt(80)).toBe("front");
    expect(sideAt(170)).toBe("back");
    expect(sideAt(180)).toBe("back");
    expect(sideAt(-180)).toBe("back");
    expect(sideAt(360)).toBe("front");
    expect(sideAt(-350)).toBe("front");
  });

  it("settles a slow release on the nearest face", () => {
    expect(releaseTarget(60, 10)).toBe(0);
    expect(releaseTarget(120, -10)).toBe(180);
  });

  it("lets a flick carry the card over to the other face, in the flick's direction", () => {
    expect(releaseTarget(30, 900)).toBe(180);
    expect(releaseTarget(-30, -900)).toBe(-180);
  });

  it("caps a very hard flick at one full spin", () => {
    expect(releaseTarget(30, 50_000)).toBe(360);
    expect(releaseTarget(-30, -50_000)).toBe(-360);
  });

  it("flips to the opposite face from wherever the card is heading", () => {
    expect(flipTarget(0)).toBe(180);
    expect(flipTarget(170)).toBe(360);
    expect(flipTarget(-180)).toBe(0);
  });

  it("turns the card with a horizontal drag and tips it with a vertical drag (clamped)", () => {
    expect(dragTurn(0, 100)).toBeCloseTo(45);
    expect(dragTurn(180, -200)).toBeCloseTo(90);
    expect(dragTiltX(0)).toBe(0);
    expect(dragTiltX(-1000)).toBe(18);
    expect(dragTiltX(1000)).toBe(-18);
  });

  it("tilts toward the pointer within a small range", () => {
    expect(hoverTilt(0, 0)).toEqual({ x: 0, y: 0 });
    expect(hoverTilt(1, -1)).toEqual({ x: 10, y: 14 });
    expect(hoverTilt(-1, 1)).toEqual({ x: -10, y: -14 });
    expect(hoverTilt(5, 5)).toEqual({ x: -10, y: 14 });
  });

  it("springs to the target with a little overshoot and comes to rest", () => {
    let spring: Spring = { value: 0, velocity: 0 };
    let peak = 0;
    for (let frame = 0; frame < 120; frame += 1) {
      spring = stepSpring(spring, 180, 16);
      peak = Math.max(peak, spring.value);
    }
    expect(peak).toBeGreaterThan(180);
    expect(peak).toBeLessThan(200);
    expect(isSettled(spring, 180)).toBe(true);
  });

  it("stays stable after a long gap between frames (background tab)", () => {
    const spring = stepSpring({ value: 0, velocity: 2000 }, 180, 5000);
    expect(Number.isFinite(spring.value)).toBe(true);
    expect(Math.abs(spring.value)).toBeLessThan(400);
  });

  it("is not settled while still moving fast near the target", () => {
    expect(isSettled({ value: 180, velocity: 300 }, 180)).toBe(false);
    expect(isSettled({ value: 175, velocity: 0 }, 180)).toBe(false);
  });

  it("smooths drag velocity in degrees per second and ignores empty time steps", () => {
    let velocity = 0;
    for (let i = 0; i < 30; i += 1) velocity = trackVelocity(velocity, 10, 16);
    expect(velocity).toBeCloseTo(625, 0);
    expect(trackVelocity(240, 10, 0)).toBe(240);
  });

  it("gives fingers a looser tap threshold than a mouse", () => {
    expect(tapSlop("mouse")).toBe(4);
    expect(tapSlop("touch")).toBe(10);
    expect(tapSlop("pen")).toBe(10);
  });

  it("places the sheen strip so its bright band sits at the given point across the card", () => {
    // แถบกว้าง 3 เท่าของบัตร แสงอยู่กลางแถบ: 50% → เลื่อนแถบไป -1 เท่าความกว้างบัตร (-33.33% ของแถบ)
    expect(sheenTranslate(50)).toBeCloseTo(-33.333, 2);
    expect(sheenTranslate(0)).toBeCloseTo(-50, 2);
    expect(sheenTranslate(100)).toBeCloseTo(-16.667, 2);
  });

  it("centres the hover light under the pointer, mirrored for the back face", () => {
    expect(lightOffset(0, 0, 280, 392, 240)).toEqual({ x: 20, xBack: 20, y: 76 });
    expect(lightOffset(1, -1, 280, 392, 240)).toEqual({ x: 160, xBack: -120, y: -120 });
  });

  it("sizes the seal text so any brand name fits once around the ring", () => {
    const circumference = 2 * Math.PI * 38;
    expect(sealFontSize(32, circumference)).toBeCloseTo(8.68, 1);
    expect(sealFontSize(90, circumference)).toBe(6);
    expect(sealFontSize(10, circumference)).toBe(9);
  });

  it("shades the paper as it turns edge-on and slides the sheen across it", () => {
    expect(edgeShade(0)).toBe(0);
    expect(edgeShade(90)).toBeCloseTo(1);
    expect(edgeShade(180)).toBeCloseTo(0);
    expect(sheenOffset(0)).toBeCloseTo(50);
    expect(sheenOffset(90)).toBeCloseTo(0);
    expect(sheenOffset(-90)).toBeCloseTo(100);
  });
});

describe("Member card content", () => {
  it("only lists perks that the entry plan really includes", () => {
    expect(MEMBER_CARD.perks.length).toBeGreaterThan(0);
    for (const perk of MEMBER_CARD.perks) expect(SITE_PLANS[0].features).toContain(perk);
  });

  it("renders the front face for everyone and keeps the back face hidden until flipped", () => {
    const html = renderToStaticMarkup(<MemberCard />);
    expect(html).toContain(siteConfig.name);
    expect(html).toContain(MEMBER_CARD.label);
    for (const perk of MEMBER_CARD.perks) expect(html).toContain(perk);
    expect(html).toMatch(/data-face="front"(?![^>]*aria-hidden)/);
    expect(html).toMatch(/data-face="back"[^>]*aria-hidden="true"/);
  });

  it("offers a real button to flip the card for keyboard and touch users", () => {
    const html = renderToStaticMarkup(<MemberCard />);
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>[\s\S]*พลิกดูสิทธิ์สมาชิก/);
    expect(html).toMatch(/aria-controls="[^"]+"/);
    // ประกาศด้านที่เปลี่ยนให้โปรแกรมอ่านหน้าจอ (ว่างตอนโหลด ไม่พูดเองโดยไม่มีใครกด)
    expect(html).toMatch(/<p[^>]*aria-live="polite"[^>]*><\/p>/);
  });

  it("does not invent numbers: no percentages, win rates or profit claims on the card", () => {
    const text = renderToStaticMarkup(<MemberCard />).replace(/<[^>]+>/g, " ");
    expect(text).toContain(MEMBER_CARD.label);
    expect(text).not.toMatch(/%|Win ?Rate|กำไร/i);
  });

  it("sits in the pricing section", () => {
    const html = renderToStaticMarkup(<PricingSection />);
    expect(html).toContain("data-member-card");
  });
});

describe("Member card styles", () => {
  const css = readFileSync(join(process.cwd(), "src/styles/paper-card.css"), "utf8");
  const motionCss = readFileSync(join(process.cwd(), "src/styles/motion.css"), "utf8");

  it("hides the face that points away from the viewer", () => {
    expect(css).toMatch(/\.pc-face\s*\{[^}]*backface-visibility:\s*hidden/);
    expect(css).toMatch(/\.pc-card\s*\{[^}]*transform-style:\s*preserve-3d/);
  });

  it("keeps vertical scrolling and pinch-zoom on touch screens while the card handles sideways drags", () => {
    expect(css).toMatch(/\.pc-card\s*\{[^}]*touch-action:\s*pan-y pinch-zoom/);
  });

  it("moves the sheen and the hover light with translate (compositor), not background-position", () => {
    expect(css).not.toMatch(/background-position:[^;]*var\(--sheen/);
    expect(css).toMatch(/\.pc-sheen\s*\{[^}]*translate:\s*var\(--sheen-x/);
    expect(css).toMatch(/\.pc-light\s*\{[^}]*translate:\s*var\(--lx/);
    expect(css).toMatch(/\.pc-face-back \.pc-light\s*\{[^}]*var\(--lx-back/);
  });

  it("hides the giant background word on browsers without overflow: clip (it would scroll sideways)", () => {
    expect(css).toMatch(/@supports not \(overflow-x: clip\)[\s\S]*\.pc-word[\s\S]*display:\s*none/);
  });

  it("stops the spinning seal for reduced motion and for the pause button", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.pc-seal-ring/);
    expect(motionCss).toMatch(/html\[data-motion-paused\][\s\S]*\.pc-seal-ring/);
  });
});
