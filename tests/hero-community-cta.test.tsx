import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HeroSection } from "@/components/marketing/hero-section";
import { HERO_CONTENT } from "@/config/marketing";
import { COMMUNITY } from "@/config/community";

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null, status: "unauthenticated" }) }));

/**
 * ปุ่มเข้าคอมมูนิตี้เคยอยู่ในส่วนสุดท้ายของหน้าแรก (ส่วนที่ 8 จาก 8)
 * คนที่มาจากโฆษณาต้องเลื่อนผ่านทั้งหน้าถึงจะเจอ จึงย้ายขึ้นมาไว้ใน Hero ด้วย
 */
describe("community call to action in the hero", () => {
  it("links straight to the Discord invite and opens it safely in a new tab", () => {
    const html = renderToStaticMarkup(<HeroSection />);
    const invite = COMMUNITY.discord.inviteUrl;

    expect(invite).toBeTruthy();
    expect(html).toContain(`href="${invite}"`);
    expect(html).toContain(HERO_CONTENT.communityCta);
    expect(html).toMatch(/rel="noopener noreferrer"/);
  });

  it("still offers the packages as the primary action", () => {
    const html = renderToStaticMarkup(<HeroSection />);
    expect(html).toContain("ดูแพ็กเกจและราคา");
    expect(html.indexOf("ดูแพ็กเกจและราคา")).toBeLessThan(html.indexOf(HERO_CONTENT.communityCta));
  });

  /**
   * "ฟรี" บนปุ่มนี้หมายถึงเข้าเซิร์ฟเวอร์ Discord ได้โดยไม่ต้องจ่ายเท่านั้น
   * ถ้าเผลอเขียนให้เข้าใจว่าได้ใช้อินดิเคเตอร์หรือสัญญาณฟรี จะกลายเป็นโฆษณาเกินจริง (CLAUDE.md ข้อ 3)
   */
  it("never promises free access to the paid entitlements", () => {
    expect(HERO_CONTENT.communityCta).not.toMatch(/อินดิเคเตอร์|สัญญาณ|สิทธิ์|VIP|ทดลอง/);
  });
});
