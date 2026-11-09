import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeFacebookUrl, resolveContact } from "@/config/site";
import { ContactProfile } from "@/components/marketing/contact-profile";
import { RISK_DISCLAIMER } from "@/config/marketing";
import { PUBLIC_ROUTES } from "@/lib/seo";

/**
 * หน้า /contact คือลิงก์เดียวที่เอาไปแปะในไบโอโซเชียลได้ (แทนบริการรวมลิงก์ของเจ้าอื่น)
 * จึงต้องแสดงเฉพาะช่องทางที่ตั้งค่าไว้จริง และต้องไม่ยิงออกไปหาโบรกเกอร์ตรง ๆ
 */
const FULL = {
  contact: { email: "support@goldhybridshot.com", line: "@goldhybridshot", telegram: "@peenoey" },
  facebook: "https://www.facebook.com/goldhybridshot",
  discordInvite: "https://discord.gg/erJFe57YY",
};

describe("normalizeFacebookUrl", () => {
  it("accepts a facebook page URL and rejects anything else", () => {
    expect(normalizeFacebookUrl(" https://www.facebook.com/goldhybridshot ")).toBe("https://www.facebook.com/goldhybridshot");
    expect(normalizeFacebookUrl("https://facebook.com/share/abc123/")).toBe("https://facebook.com/share/abc123");
    expect(normalizeFacebookUrl("https://web.facebook.com/goldhybridshot")).toBe("https://web.facebook.com/goldhybridshot");
    for (const bad of ["", undefined, "facebook.com/x", "http://facebook.com/x", "https://evil.com/facebook.com", "javascript:alert(1)", "https://facebook.com.evil.com/x"]) {
      expect(normalizeFacebookUrl(bad)).toBeNull();
    }
  });

  /**
   * ลิงก์ที่เจ้าของเว็บก๊อปมาจากแอป Facebook จริงมักพ่วง query ติดตามมาด้วย
   * ถ้าปฏิเสธทิ้งปุ่มจะหายไปเงียบ ๆ ทั้งที่ลิงก์ใช้ได้ จึงตัด query แล้วเก็บเฉพาะ path
   */
  it("drops the tracking query that a copied link carries", () => {
    expect(normalizeFacebookUrl("https://www.facebook.com/goldhybridshot?mibextid=LQQJ4d&rdid=xyz")).toBe(
      "https://www.facebook.com/goldhybridshot",
    );
    expect(normalizeFacebookUrl("https://www.facebook.com/share/p/abc123/?mibextid=wwXIfr#post")).toBe(
      "https://www.facebook.com/share/p/abc123",
    );
  });

  /** id ของ /profile.php คือตัวระบุเพจ ตัดทิ้งแล้วลิงก์จะพาไปหน้าโปรไฟล์ของคนที่กดเอง */
  it("keeps the id of a profile.php link and rejects one without a usable id", () => {
    expect(normalizeFacebookUrl("https://web.facebook.com/profile.php?id=61560000000000&sk=about")).toBe(
      "https://web.facebook.com/profile.php?id=61560000000000",
    );
    for (const bad of [
      "https://facebook.com/profile.php",
      "https://facebook.com/profile.php?id=",
      "https://facebook.com/profile.php?id=not-a-number",
    ]) {
      expect(normalizeFacebookUrl(bad)).toBeNull();
    }
  });

  /** ประกอบ URL ใหม่จาก host + path ที่ตรวจแล้ว ไม่คืนค่าดิบที่อาจมีส่วนอื่นแฝงมา */
  it("strips credentials and a port instead of handing them to the browser", () => {
    expect(normalizeFacebookUrl("https://evil@facebook.com/goldhybridshot")).toBe("https://facebook.com/goldhybridshot");
    expect(normalizeFacebookUrl("https://facebook.com:443/goldhybridshot")).toBe("https://facebook.com/goldhybridshot");
  });

  it("is wired into resolveContact", () => {
    expect(resolveContact({ NEXT_PUBLIC_CONTACT_FACEBOOK: "https://www.facebook.com/goldhybridshot" }).facebook).toBe(
      "https://www.facebook.com/goldhybridshot",
    );
    expect(resolveContact({ NEXT_PUBLIC_CONTACT_FACEBOOK: "ไม่ใช่ลิงก์" }).facebook).toBeNull();
  });
});

describe("ContactProfile", () => {
  it("shows every channel that is configured", () => {
    const markup = renderToStaticMarkup(<ContactProfile {...FULL} />);

    expect(markup).toContain("@goldhybridshot");
    expect(markup).toContain("@peenoey");
    expect(markup).toContain("support@goldhybridshot.com");
    expect(markup).toContain(FULL.discordInvite);
    expect(markup).toContain(FULL.facebook);
  });

  it("hides the channels that are not configured instead of showing dead links", () => {
    const markup = renderToStaticMarkup(
      <ContactProfile contact={{ email: null, line: "@goldhybridshot", telegram: null }} facebook={null} discordInvite={null} />,
    );

    expect(markup).toContain("@goldhybridshot");
    expect(markup).not.toContain("mailto:");
    expect(markup).not.toContain("t.me");
    expect(markup).not.toContain("discord.gg");
    expect(markup).not.toContain("facebook.com");
  });

  /**
   * หน้ารวมลิงก์ของคนอื่นมักยิงลิงก์พาร์ทเนอร์โบรกเกอร์ตรง ๆ โดยไม่บอกว่าได้ค่าตอบแทน
   * ของเราต้องพาไปหน้า /broker-ib ซึ่งมีเงื่อนไขและข้อความเปิดเผยครบก่อนเสมอ
   */
  it("routes the broker offer through the page that carries the disclosure", () => {
    const markup = renderToStaticMarkup(<ContactProfile {...FULL} />);

    expect(markup).toContain('href="/broker-ib"');
    expect(markup).not.toMatch(/xm\.com|exness|affs\.click/i);
  });

  it("keeps the risk warning on the page", () => {
    expect(renderToStaticMarkup(<ContactProfile {...FULL} />)).toContain(RISK_DISCLAIMER);
  });

  it("sends people to the packages as well, not only to chat", () => {
    expect(renderToStaticMarkup(<ContactProfile {...FULL} />)).toContain('href="/#pricing"');
  });
});

describe("the contact page is discoverable", () => {
  it("is listed in the sitemap", () => {
    expect(PUBLIC_ROUTES.map((route) => route.path)).toContain("/contact");
  });
});
