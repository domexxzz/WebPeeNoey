import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LiveChart } from "@/components/marketing/live-chart";
import { HERO_CONTENT, TRADINGVIEW_CHART } from "@/config/marketing";
import { LEGAL_DOCUMENTS } from "@/content/legal";

describe("TradingView live chart in the hero", () => {
  const html = renderToStaticMarkup(
    <figure>
      <LiveChart decorations={<span data-testid="decoration" />} />
    </figure>,
  );

  it("server-renders the drawn chart and the illustration caption until the real chart has loaded", () => {
    expect(html).toContain("hc-anim");
    expect(html).toContain(HERO_CONTENT.visualCaption);
    expect(html).not.toContain(HERO_CONTENT.liveChartCaption);
  });

  it("never ships the third-party script in the server HTML (loaded only after page load, on screen, when idle)", () => {
    expect(html).not.toContain("<script");
    expect(html).toContain('class="tradingview-widget-container__widget');
  });

  it("keeps a fixed aspect ratio so swapping in the iframe causes no layout shift, and disables touch dragging", () => {
    expect(html).toContain("aspect-[4/3]");
    expect(html).toContain("sm:aspect-[16/10]");
    expect(html).toContain("[@media(pointer:coarse)]:pointer-events-none");
  });

  it("renders the decorations passed from the server component", () => {
    expect(html).toContain('data-testid="decoration"');
  });

  it("uses the official TradingView embed with Thai locale, Bangkok time and the required attribution link", () => {
    expect(TRADINGVIEW_CHART.scriptSrc).toBe("https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js");
    expect(TRADINGVIEW_CHART.attributionHref).toBe("https://www.tradingview.com/");
    expect(TRADINGVIEW_CHART.config).toMatchObject({ locale: "th_TH", timezone: "Asia/Bangkok", theme: "light", autosize: true });
  });

  it("states that the live chart does not show our indicator's signals and is not investment advice", () => {
    expect(HERO_CONTENT.liveChartCaption).toContain("ไม่ได้แสดงสัญญาณของอินดิเคเตอร์ Gold Hybridshot");
    expect(HERO_CONTENT.liveChartCaption).toContain("ไม่ใช่คำแนะนำการลงทุน");
  });

  it("draws identical chart coordinates even when Math.sin differs in the last digits (server vs browser hydration)", async () => {
    vi.resetModules();
    const { HeroChart: ServerChart } = await import("@/components/marketing/hero-chart");
    const server = renderToStaticMarkup(<ServerChart animated />);
    const sin = Math.sin;
    Math.sin = (value: number) => sin(value) * (1 + 1e-13);
    try {
      vi.resetModules();
      const { HeroChart: BrowserChart } = await import("@/components/marketing/hero-chart");
      expect(renderToStaticMarkup(<BrowserChart animated />)).toBe(server);
    } finally {
      Math.sin = sin;
    }
  });

  it("discloses the TradingView embed in the privacy policy", () => {
    expect(JSON.stringify(LEGAL_DOCUMENTS.privacy)).toContain("TradingView อาจได้รับข้อมูลทางเทคนิค");
  });
});
