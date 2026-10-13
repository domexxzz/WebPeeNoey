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

describe("Brand name: Gold Hybridshot", () => {
  it("uses the indicator's name as the site name", () => {
    expect(siteConfig.name).toBe("Gold Hybridshot");
    // แถบตัวอักษรวิ่งเป็นชื่อแบรนด์ทั้งแถบ (เจ้าของขอ)
    expect(HERO_CONTENT.marquee.length).toBeGreaterThanOrEqual(3);
    HERO_CONTENT.marquee.forEach((word) => expect(word).toBe(siteConfig.name));
  });

  it("leaves no hard-coded old product name in the app source (titles, emails, bot replies come from siteConfig)", () => {
    const offenders = sourceFiles(join(process.cwd(), "src")).filter((file) => readFileSync(file, "utf8").includes("Peenoey Indicator"));
    expect(offenders).toEqual([]);
  });

  it("renders the large wordmark as whole words with a real space between them, so a narrow footer column wraps instead of overflowing", () => {
    const html = renderToStaticMarkup(<BrandMark size="xl" />);
    const visible = html.replace(/<[^>]+>/g, "");
    expect(visible).toBe(siteConfig.shortName);
    expect(html.match(/inline-block whitespace-nowrap/g)).toHaveLength(siteConfig.shortName.split(" ").length);
    expect(html).not.toContain(" ");
    expect(html).toContain(`aria-label="${siteConfig.name} หน้าแรก"`);
  });
});
