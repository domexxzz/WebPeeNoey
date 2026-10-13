import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { siteConfig } from "@/config/site";
import { HERO_CONTENT } from "@/config/marketing";
import { BrandMark } from "@/components/marketing/site-header";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("Brand name: Gold HybridShot", () => {
  it("uses the indicator's name as the site name", () => {
    expect(siteConfig.name).toBe("Gold HybridShot");
    expect(HERO_CONTENT.marquee).toContain("Gold HybridShot");
  });

  it("leaves no hard-coded old product name in the app source (titles, emails, bot replies come from siteConfig)", () => {
    const offenders = sourceFiles(join(process.cwd(), "src")).filter((file) => readFileSync(file, "utf8").includes("Peenoey Indicator"));
    expect(offenders).toEqual([]);
  });

  it("keeps the space between words in the large animated wordmark", () => {
    const html = renderToStaticMarkup(<BrandMark size="xl" />);
    expect(html).toContain(" ");
    expect(html).toContain(`aria-label="${siteConfig.name} หน้าแรก"`);
  });
});
