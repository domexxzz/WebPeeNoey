import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  FAILSAFE_MS,
  collectTargets,
  headerShouldHide,
  loadDelayStyle,
  pointerRatio,
  readMotionPaused,
  scrollProgress,
  scrollState,
  staggerStyle,
  startedAfterFailsafe,
} from "@/lib/motion";
import { HeroChart } from "@/components/marketing/hero-chart";
import { HeroSection } from "@/components/marketing/hero-section";
import { Phrases } from "@/components/marketing/phrases";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FeaturesSection } from "@/components/marketing/features-section";
import { HowItWorksSection } from "@/components/marketing/how-it-works-section";
import { MotionRuntime } from "@/components/motion/motion-runtime";
import { MotionToggle } from "@/components/motion/motion-toggle";
import { PromptPayQr } from "@/components/checkout/promptpay-qr";
import { SITE_PLANS } from "@/config/plans";

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null, status: "unauthenticated" }) }));

const css = ["src/styles/motion.css", "src/styles/motion-art.css"].map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");

describe("motion helpers", () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 };

  it("maps the pointer to -1..1 from the element centre plus local pixel coordinates", () => {
    expect(pointerRatio(rect, 200, 100)).toEqual({ px: 0, py: 0, x: 100, y: 50 });
    expect(pointerRatio(rect, 100, 50)).toEqual({ px: -1, py: -1, x: 0, y: 0 });
    expect(pointerRatio(rect, 300, 150)).toEqual({ px: 1, py: 1, x: 200, y: 100 });
  });

  it("clamps the ratio when the pointer is outside the element and survives zero-size boxes", () => {
    expect(pointerRatio(rect, 900, -400)).toMatchObject({ px: 1, py: -1 });
    expect(pointerRatio({ left: 0, top: 0, width: 0, height: 0 }, 10, 10)).toEqual({ px: 0, py: 0, x: 0, y: 0 });
  });

  it("returns scroll progress between 0 and 1 and 0 when the page cannot scroll", () => {
    expect(scrollProgress(0, 2000, 1000)).toBe(0);
    expect(scrollProgress(500, 2000, 1000)).toBe(0.5);
    expect(scrollProgress(5000, 2000, 1000)).toBe(1);
    expect(scrollProgress(100, 800, 1000)).toBe(0);
  });

  it("hides the header only when scrolling down past the threshold", () => {
    expect(headerShouldHide(400, 300)).toBe(true);
    expect(headerShouldHide(300, 400)).toBe(false);
    expect(headerShouldHide(60, 20)).toBe(false);
  });

  it("derives progress, header shadow and header visibility from one scroll step", () => {
    const base = { previousY: 300, scrollHeight: 3000, viewportHeight: 1000, keepHeaderVisible: false, headerHidden: false };
    expect(scrollState({ ...base, y: 500 })).toEqual({ progress: 0.25, scrolled: true, headerHidden: true, previousY: 500 });
    expect(scrollState({ ...base, y: 200, headerHidden: true })).toMatchObject({ headerHidden: false, previousY: 200 });
    expect(scrollState({ ...base, y: 0 })).toMatchObject({ scrolled: false, headerHidden: false });
  });

  it("never hides the header while focus or the mobile menu is inside it", () => {
    const state = scrollState({ y: 900, previousY: 400, scrollHeight: 3000, viewportHeight: 1000, keepHeaderVisible: true, headerHidden: true });
    expect(state.headerHidden).toBe(false);
  });

  it("ignores tiny scroll jitter so the header does not flicker", () => {
    const state = scrollState({ y: 503, previousY: 500, scrollHeight: 3000, viewportHeight: 1000, keepHeaderVisible: false, headerHidden: true });
    expect(state).toMatchObject({ headerHidden: true, previousY: 500 });
  });

  it("treats a runtime that starts near or after the CSS failsafe as late, so revealed content never hides again", () => {
    expect(startedAfterFailsafe(400)).toBe(false);
    expect(startedAfterFailsafe(FAILSAFE_MS - 100)).toBe(true);
    expect(startedAfterFailsafe(FAILSAFE_MS + 5000)).toBe(true);
  });

  it("collects reveal targets from newly inserted nodes only (self and descendants), skipping text nodes", () => {
    const child = { id: "child" };
    const self = { nodeType: 1, matches: () => true, querySelectorAll: () => [child] };
    const plain = { nodeType: 1, matches: () => false, querySelectorAll: () => [] };
    const text = { nodeType: 3 };
    expect(collectTargets([self, plain, text], "[data-reveal]")).toEqual([self, child]);
  });

  it("reads the saved pause preference and falls back to playing when storage is unavailable", () => {
    expect(readMotionPaused(() => "paused")).toBe(true);
    expect(readMotionPaused(() => null)).toBe(false);
    expect(
      readMotionPaused(() => {
        throw new Error("SecurityError");
      }),
    ).toBe(false);
  });

  it("builds capped stagger and load delays as CSS custom properties", () => {
    expect(staggerStyle(0)).toEqual({ "--reveal-delay": "0ms" });
    expect(staggerStyle(3, 90)).toEqual({ "--reveal-delay": "270ms" });
    expect(staggerStyle(40, 90, 600)).toEqual({ "--reveal-delay": "600ms" });
    expect(loadDelayStyle(250)).toEqual({ "--load-delay": "250ms" });
  });
});

describe("animated markup", () => {
  it("keeps the default phrase markup and adds word-reveal spans only when asked", () => {
    expect(renderToStaticMarkup(<Phrases text="ก ข" />)).toBe('<span class="inline-block max-w-full">ก</span> <span class="inline-block max-w-full">ข</span>');
    const animated = renderToStaticMarkup(<Phrases text="ก ข ค" animate />);
    expect(animated.match(/mx-word/g)).toHaveLength(3);
    expect(animated).toContain("--i:2");
  });

  it("renders the animated hero chart as decoration only: hidden from assistive tech, no text or numbers", () => {
    const html = renderToStaticMarkup(<HeroChart animated />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("hc-anim");
    expect(html).toContain('class="hc-scan"');
    expect(html).toContain('class="hc-breathe"');
    expect(html).not.toMatch(/<text|<title/);
    expect(renderToStaticMarkup(<HeroChart />)).not.toContain("hc-anim");
  });

  it("wires the hero pointer effects and off-screen pausing, without tilting the interactive live chart", () => {
    const html = renderToStaticMarkup(<HeroSection />);
    expect(html).not.toContain("data-tilt");
    expect(html).toContain("tradingview-widget-container");
    expect(html).toContain("data-magnetic");
    expect(html).toContain("data-spotlight");
    expect(html).toContain("data-loop");
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
  });

  it("reveals pricing cards with a stagger and gives only the popular plan the border beam", () => {
    const html = renderToStaticMarkup(<PricingSection />);
    expect(html.match(/data-reveal="up"/g)?.length).toBeGreaterThanOrEqual(SITE_PLANS.length);
    expect(html.match(/mx-beam-frame/g)?.length ?? 0).toBe(SITE_PLANS.filter((plan) => plan.popular).length);
    expect(html).toContain("data-loop");
  });

  it("clips the how-it-works section horizontally so cards sliding in from the right never widen the page", () => {
    const html = renderToStaticMarkup(<HowItWorksSection />);
    expect(html).toMatch(/<section[^>]*class="[^"]*overflow-x-clip/);
    expect(html.match(/data-reveal="right"/g)?.length).toBeGreaterThan(0);
  });

  it("reveals feature rows and keeps the feature art decorative", () => {
    const html = renderToStaticMarkup(<FeaturesSection />);
    expect(html).toContain('data-reveal="art"');
    expect(html).not.toMatch(/<text|<title/);
  });

  it("shows real screenshots for the indicator, Telegram and Discord rows with the pop-in animation", () => {
    const html = renderToStaticMarkup(<FeaturesSection />);
    ["indicator-chart.webp", "telegram-alert.webp", "discord-channels.webp"].forEach((file) => {
      expect(html).toMatch(new RegExp(`<div class="fa-pop fa-center"><div class="fa-photo[^"]*">(?:<div[^>]*>)?<img[^>]*alt="[^"]+"[^>]*${file.replace(".", "\\.")}`));
    });
    expect(html).toMatch(/sizes="\(min-width: 1024px\) 560px, 100vw"/);
  });

  it("animates each screenshot its own way and adds a hover shine", () => {
    const html = renderToStaticMarkup(<FeaturesSection />);
    expect(html.match(/class="fa-photo mx-shine/g)).toHaveLength(3);
    expect(html).toContain("fa-wipe"); // กราฟเผยจากซ้ายไปขวา
    expect(html.match(/class="fa-pulse"/g)).toHaveLength(4); // BUY, TP1, TP2, SL
    expect(html).toContain("fa-slide"); // ข้อความ Telegram เลื่อนเข้า
    expect(html).toContain("fa-typing");
    expect(html).toContain("fa-scan"); // ไฮไลต์ไล่ห้อง Discord
    // ชิ้นตกแต่งไม่ถูกอ่านซ้ำโดยโปรแกรมอ่านหน้าจอ
    expect(html).not.toMatch(/class="fa-(pulse|typing|scan)"(?![^>]*aria-hidden="true")/);
  });

  it("renders nothing on the server for the motion runtime", () => {
    expect(renderToStaticMarkup(<MotionRuntime />)).toBe("");
  });

  it("renders an accessible pause button for looping motion (WCAG 2.2.2)", () => {
    const html = renderToStaticMarkup(<MotionToggle />);
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-label="หยุดภาพเคลื่อนไหว"');
  });

  it("keeps the payment QR at full size and draws the animated frame outside it", async () => {
    const html = renderToStaticMarkup(await PromptPayQr({ payload: "000201010211", label: "PromptPay QR" }));
    expect(html).toMatch(/<div class="mx-qr mx-auto w-full max-w-\[280px\]"><div role="img"/);
  });
});

describe("motion stylesheet", () => {
  it("turns every animation and transition off for people who prefer reduced motion", () => {
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toMatch(/animation:\s*none\s*!important/);
    expect(block).toMatch(/transition:\s*none\s*!important/);
    expect(block).toMatch(/\[data-reveal\][^{]*\{[^}]*opacity:\s*1/);
  });

  it("only hides reveal targets when scripting is on, with a failsafe if the runtime never starts", () => {
    expect(css).toContain("@media (scripting: enabled)");
    expect(css).toContain("html:not([data-motion]) [data-reveal],");
    expect(css).toContain("html:not([data-motion]) [data-reveal] .mx-digit,");
    expect(css).toContain(`mx-failsafe 0.4s ${FAILSAFE_MS / 1000}s`);
  });

  it("keeps the hidden header visible while it holds keyboard focus", () => {
    expect(css).toContain("html[data-header-hidden] [data-site-header]:not(:focus-within)");
  });

  it("never clips a reveal target before it is seen (Chrome counts the element's own clip-path in IntersectionObserver)", () => {
    const hiddenStates = css.slice(css.indexOf("@media (scripting: enabled)"), css.indexOf("@keyframes mx-failsafe"));
    expect(hiddenStates).not.toContain("clip-path");
  });

  it("pauses looping animations off-screen and when the visitor presses pause", () => {
    expect(css).toMatch(/\[data-loop\]\[data-offscreen\][^{]*\{[^}]*animation-play-state:\s*paused/);
    expect(css).toMatch(/html\[data-motion-paused\][\s\S]*?animation:\s*none\s*!important/);
  });

  it("pauses the screenshot loops and leaves the screenshots uncovered for reduced motion", () => {
    const paused = css.slice(css.indexOf("html[data-motion-paused] :is("));
    expect(paused.slice(0, paused.indexOf(")"))).toMatch(/\.fa-pulse[\s\S]*\.fa-scan|\.fa-scan[\s\S]*\.fa-pulse/);
    const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.fa-wipe,\s*\.fa-typing,[^{]*\{\s*display:\s*none/);
    expect(reduced).toMatch(/\.fa-slide\s*\{\s*opacity:\s*1\s*!important/);
  });

  it("only applies the 3D tilt transform while the pointer is on the element", () => {
    expect(css).toMatch(/\[data-tilt\]\[data-pointer-active\] \{\s*transform: perspective/);
    expect(css).not.toMatch(/\[data-tilt\] \{[^}]*transform: perspective/);
  });

  it("animates compositor-friendly properties only (no layout properties or repaint-heavy custom properties in keyframes)", () => {
    const keyframes = css.match(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g) ?? [];
    expect(keyframes.length).toBeGreaterThan(5);
    keyframes.forEach((block) => expect(block).not.toMatch(/\b(width|height|top|left|margin|padding)\s*:|--[\w-]+\s*:/));
  });
});
