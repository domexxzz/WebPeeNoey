import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolveScriptAccessUrl, tradingViewProfileUrl } from "@/lib/admin/tradingview-access";
import { TradingViewGrantHelper } from "@/components/admin/tradingview-grant-helper";

const PERIOD_END = new Date("2026-11-04T11:05:44.152Z");

describe("tradingViewProfileUrl", () => {
  it("builds the profile link for a real username", () => {
    expect(tradingViewProfileUrl("YeepY_YeepY")).toBe("https://www.tradingview.com/u/YeepY_YeepY/");
    expect(tradingViewProfileUrl("  Anekevchul  ")).toBe("https://www.tradingview.com/u/Anekevchul/");
  });

  it("refuses anything that is not a plain username, so nothing can be smuggled into the href", () => {
    for (const bad of ["", null, undefined, "a", "has space", "../../evil", "name?x=1", "name#frag", "https://evil.test", "ชื่อไทย"]) {
      expect(tradingViewProfileUrl(bad)).toBeNull();
    }
  });
});

describe("resolveScriptAccessUrl", () => {
  it("accepts a TradingView script page over https", () => {
    expect(resolveScriptAccessUrl("https://www.tradingview.com/script/abc123-gold-hybridshot/")).toBe("https://www.tradingview.com/script/abc123-gold-hybridshot/");
    expect(resolveScriptAccessUrl("https://th.tradingview.com/script/abc123/")).toBe("https://th.tradingview.com/script/abc123/");
  });

  it("rejects other hosts, other paths and plain http", () => {
    for (const bad of ["", undefined, "http://www.tradingview.com/script/abc/", "https://tradingview.com.evil.test/script/abc/", "https://www.tradingview.com/u/someone/", "not a url"]) {
      expect(resolveScriptAccessUrl(bad)).toBeNull();
    }
  });
});

describe("TradingViewGrantHelper", () => {
  it("shows the username to copy, the profile link and the expiry date to set in TradingView", () => {
    const html = renderToStaticMarkup(<TradingViewGrantHelper username="YeepY_YeepY" periodEnd={PERIOD_END} scriptAccessUrl="https://www.tradingview.com/script/abc123/" />);

    expect(html).toContain("YeepY_YeepY");
    expect(html).toContain('href="https://www.tradingview.com/u/YeepY_YeepY/"');
    expect(html).toContain('href="https://www.tradingview.com/script/abc123/"');
    // วันหมดอายุที่ต้องใส่ใน TradingView (เวลาไทย: 4 พ.ย. 18:05)
    expect(html).toMatch(/4 พ\.ย\.|04\/11|2569/);
    expect(html).toContain("ติ๊ก");
  });

  it("leaves out the script link when it is not configured", () => {
    const html = renderToStaticMarkup(<TradingViewGrantHelper username="YeepY_YeepY" periodEnd={PERIOD_END} scriptAccessUrl={null} />);

    expect(html).toContain("YeepY_YeepY");
    expect(html).not.toContain("/script/");
  });

  it("warns instead of linking when the member never filled in a username", () => {
    const html = renderToStaticMarkup(<TradingViewGrantHelper username={null} periodEnd={PERIOD_END} scriptAccessUrl={null} />);

    expect(html).toContain("ยังไม่ได้กรอก");
    expect(html).not.toContain("tradingview.com/u/");
  });

  it("does not link a username that fails validation", () => {
    const html = renderToStaticMarkup(<TradingViewGrantHelper username="bad name" periodEnd={PERIOD_END} scriptAccessUrl={null} />);

    expect(html).not.toContain("tradingview.com/u/");
    expect(html).toContain("bad name");
  });
});
