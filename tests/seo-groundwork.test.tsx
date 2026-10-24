import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  analyticsDisclosure,
  buildVerificationMetadata,
  normalizeCloudflareAnalyticsToken,
  normalizeVerificationToken,
  resolveIntegrations,
} from "@/config/integrations";
import { AnalyticsScript } from "@/components/marketing/analytics-script";
import { LegalPage } from "@/components/marketing/legal-page";
import { TERMS_DOCUMENT } from "@/content/legal";
import { SITE_PLANS } from "@/config/plans";
import { RISK_DISCLAIMER } from "@/config/marketing";
import { siteConfig } from "@/config/site";
import { absoluteUrl, buildBreadcrumbJsonLd, buildOrganizationJsonLd, buildWebSiteJsonLd } from "@/lib/seo";
import { buildLlmsTxt } from "@/lib/llms";
import { GET as getLlmsTxt } from "@/app/llms.txt/route";

const CF_TOKEN = "0123456789abcdef0123456789abcdef";
const NO_CONTACT = { email: null, line: null, telegram: null };

describe("search engine verification tokens", () => {
  it("accepts the token text and rejects anything that could break out of the meta tag", () => {
    expect(normalizeVerificationToken(" AbC_123-xyz987 ")).toBe("AbC_123-xyz987");
    for (const bad of ["", undefined, "short", 'abc"><script>', "has space token", "<meta name=x>"]) {
      expect(normalizeVerificationToken(bad)).toBeNull();
    }
  });

  it("builds Next.js verification metadata only for the tokens that are set", () => {
    expect(buildVerificationMetadata({ googleSiteVerification: "google-token-123", bingSiteVerification: "BING0123456789ABCDEF" })).toEqual({
      google: "google-token-123",
      other: { "msvalidate.01": "BING0123456789ABCDEF" },
    });
    expect(buildVerificationMetadata({ googleSiteVerification: "google-token-123", bingSiteVerification: null })).toEqual({
      google: "google-token-123",
    });
    expect(buildVerificationMetadata({ googleSiteVerification: null, bingSiteVerification: null })).toBeUndefined();
  });
});

describe("Cloudflare Web Analytics", () => {
  it("accepts only a 32-character hex beacon token", () => {
    expect(normalizeCloudflareAnalyticsToken(` ${CF_TOKEN.toUpperCase()} `)).toBe(CF_TOKEN);
    for (const bad of ["", undefined, "abc", `${CF_TOKEN}0`, "0123456789abcdef0123456789abcdeg", `"${CF_TOKEN}"}`]) {
      expect(normalizeCloudflareAnalyticsToken(bad)).toBeNull();
    }
  });

  it("reads every integration from env and leaves unset ones empty", () => {
    expect(
      resolveIntegrations({
        NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "google-token-123",
        NEXT_PUBLIC_BING_SITE_VERIFICATION: "",
        NEXT_PUBLIC_CF_ANALYTICS_TOKEN: CF_TOKEN,
      }),
    ).toEqual({ googleSiteVerification: "google-token-123", bingSiteVerification: null, cloudflareAnalyticsToken: CF_TOKEN });
  });

  it("loads the beacon deferred with the token, and nothing without a token", () => {
    const html = renderToStaticMarkup(<AnalyticsScript token={CF_TOKEN} />);
    expect(html).toContain('src="https://static.cloudflareinsights.com/beacon.min.js"');
    expect(html).toContain("defer");
    expect(html).toContain(`data-cf-beacon="{&quot;token&quot;:&quot;${CF_TOKEN}&quot;}"`);
    expect(renderToStaticMarkup(<AnalyticsScript token={null} />)).toBe("");
  });

  it("discloses the cookieless analytics in the privacy policy only when it is enabled", () => {
    expect(analyticsDisclosure(true)).toMatch(/Cloudflare Web Analytics/);
    expect(analyticsDisclosure(true)).toMatch(/ไม่ใช้คุกกี้/);
    expect(analyticsDisclosure(false)).toBeNull();
  });
});

describe("WebSite and Organization JSON-LD", () => {
  it("links the website to the organization by @id", () => {
    const organization = buildOrganizationJsonLd(NO_CONTACT);
    const website = buildWebSiteJsonLd();
    expect(organization["@id"]).toBe(`${absoluteUrl("/")}#organization`);
    expect(website).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${absoluteUrl("/")}#website`,
      name: siteConfig.name,
      url: absoluteUrl("/"),
      inLanguage: "th-TH",
      publisher: { "@id": organization["@id"] },
    });
  });
});

describe("BreadcrumbList JSON-LD", () => {
  it("starts at the homepage and lists each crumb with an absolute URL", () => {
    expect(buildBreadcrumbJsonLd([{ name: "ฟีเจอร์และสิ่งที่ได้รับ", path: "/features" }])).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "หน้าแรก", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "ฟีเจอร์และสิ่งที่ได้รับ", item: absoluteUrl("/features") },
      ],
    });
  });

  it("is embedded in the legal pages", () => {
    const html = renderToStaticMarkup(<LegalPage document={TERMS_DOCUMENT} />);
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain(absoluteUrl(`/${TERMS_DOCUMENT.slug}`));
  });
});

describe("llms.txt", () => {
  const base = { contact: NO_CONTACT, isLegalDraft: true };

  it("summarizes the brand, pages, real plan prices and the risk disclaimer", () => {
    const text = buildLlmsTxt(base);
    expect(text.startsWith(`# ${siteConfig.name}\n\n> ${siteConfig.description}`)).toBe(true);
    expect(text).toContain(absoluteUrl("/features"));
    expect(text).toContain(absoluteUrl("/guide"));
    SITE_PLANS.forEach((plan) => expect(text).toContain(`${plan.name}: ${plan.price.toLocaleString("en-US")} บาท`));
    expect(text).toContain(RISK_DISCLAIMER);
  });

  it("leaves out draft legal pages and unset contacts, and lists them once they exist", () => {
    const draft = buildLlmsTxt(base);
    expect(draft).not.toContain(absoluteUrl("/terms"));
    expect(draft).not.toContain("## ติดต่อ");

    const published = buildLlmsTxt({ contact: { ...NO_CONTACT, email: "support@goldhybridshot.com" }, isLegalDraft: false });
    expect(published).toContain(absoluteUrl("/terms"));
    expect(published).toContain("support@goldhybridshot.com");
  });

  it("never states performance statistics", () => {
    expect(buildLlmsTxt(base)).not.toMatch(/win\s*rate|วินเรท|กำไร\s*\d|\d+(\.\d+)?\s*%/i);
  });

  it("is served as UTF-8 plain text", async () => {
    const response = getLlmsTxt();
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toContain(`# ${siteConfig.name}`);
  });
});

describe("deploy config for SEO integrations", () => {
  it("declares the new env vars in render.yaml and .env.example", () => {
    const root = path.resolve(__dirname, "..");
    const renderYaml = readFileSync(path.join(root, "render.yaml"), "utf8");
    const envExample = readFileSync(path.join(root, ".env.example"), "utf8");
    for (const key of ["NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION", "NEXT_PUBLIC_BING_SITE_VERIFICATION", "NEXT_PUBLIC_CF_ANALYTICS_TOKEN"]) {
      expect(renderYaml).toContain(`key: ${key}`);
      expect(envExample).toContain(`${key}=`);
    }
  });
});
