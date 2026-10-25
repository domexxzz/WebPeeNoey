import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IndicatorShowcaseSection } from "@/components/marketing/indicator-showcase-section";
import { INDICATOR_SHOWCASE } from "@/config/marketing";

describe("Real indicator screenshot section", () => {
  const html = renderToStaticMarkup(<IndicatorShowcaseSection />);
  const { image } = INDICATOR_SHOWCASE;

  it("ships a real screenshot whose file matches the declared size (no layout shift, correct next/image ratio)", () => {
    // WebP แบบ lossy (RIFF/VP8): ขนาดอยู่ที่ไบต์ 26–29 ฝั่งละ 14 บิต
    const file = readFileSync(join(process.cwd(), "public", image.src));
    expect(file.subarray(0, 4).toString()).toBe("RIFF");
    expect(file.subarray(8, 16).toString()).toBe("WEBPVP8 ");
    expect(file.readUInt16LE(26) & 0x3fff).toBe(image.width);
    expect(file.readUInt16LE(28) & 0x3fff).toBe(image.height);
  });

  it("renders the screenshot through next/image with sizes and a descriptive Thai alt text", () => {
    expect(html).toContain("<img");
    expect(html).toContain(`sizes="${image.sizes}"`);
    expect(html).toContain(`alt="${image.alt}"`);
    expect(html).toContain(`href="${image.src}"`);
  });

  it("states that the table statistics are back-calculated on that chart, not members' real results, and not a guarantee", () => {
    expect(html).toContain(INDICATOR_SHOWCASE.disclaimer);
    expect(INDICATOR_SHOWCASE.disclaimer).toContain("สถิติย้อนหลัง");
    expect(INDICATOR_SHOWCASE.disclaimer).toContain("ไม่ใช่ผลการเทรดจริงของสมาชิก");
    expect(INDICATOR_SHOWCASE.disclaimer).toContain("ไม่รับประกันผลในอนาคต");
  });

  it("does not lift performance numbers out of the screenshot into marketing copy", () => {
    const copy = [INDICATOR_SHOWCASE.title, INDICATOR_SHOWCASE.description, ...INDICATOR_SHOWCASE.legend.flatMap((item) => [item.title, item.description])].join(" ");
    expect(copy).not.toMatch(/\d+(\.\d+)?\s*%/);
    expect(copy).not.toMatch(/win\s*rate/i);
  });

  it("explains every legend item and has its own section id for linking", () => {
    INDICATOR_SHOWCASE.legend.forEach((item) => expect(html).toContain(item.title));
    expect(html).toContain(`id="${INDICATOR_SHOWCASE.id}"`);
  });
});
