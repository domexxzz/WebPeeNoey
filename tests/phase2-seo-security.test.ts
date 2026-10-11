import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import nextConfig from "../next.config.mjs";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { metadata as termsMetadata } from "@/app/(marketing)/terms/page";
import { metadata as privacyMetadata } from "@/app/(marketing)/privacy/page";
import { metadata as refundMetadata } from "@/app/(marketing)/refund/page";
import { resolveSiteUrl } from "@/config/site";
import {
  LEGAL_PATHS,
  PRIVATE_PATH_PREFIXES,
  PUBLIC_ROUTES,
  getIndexableRoutes,
  buildFaqJsonLd,
  buildPageMetadata,
  buildProductJsonLd,
  serializeJsonLd,
} from "@/lib/seo";
import { FAQ_ITEMS, FEATURES, FOOTER_NAV, HERO_CONTENT, HOME_SECTION_IDS, HOW_IT_WORKS, MAIN_NAV } from "@/config/marketing";
import { PAYMENT_RULES } from "@/config/payment";
import { legalConfig } from "@/config/legal";
import { GUIDE_SECTIONS, TROUBLESHOOTING } from "@/content/guide";
import { FEATURE_DETAILS } from "@/content/features";
import { LEGAL_DOCUMENTS } from "@/content/legal";
import { SITE_PLANS } from "@/config/plans";
import { siteConfig } from "@/config/site";

const APP_DIR = path.resolve(__dirname, "../src/app");

/** สร้างรายการ route จริงจากไฟล์ page.tsx ทั้งหมด (ตัด route group เช่น "(marketing)" ออก) */
function collectAppRoutes(dir: string, segments: string[] = []): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      const isGroup = /^\(.+\)$/.test(entry.name);
      return collectAppRoutes(path.join(dir, entry.name), isGroup ? segments : [...segments, entry.name]);
    }
    return entry.name === "page.tsx" ? [`/${segments.join("/")}`] : [];
  });
}

const APP_ROUTES = new Set(collectAppRoutes(APP_DIR));
const SECTION_IDS = new Set<string>(Object.values(HOME_SECTION_IDS));

function assertInternalLinkResolves(href: string) {
  const [pathPart, hash] = href.split("#");
  const pathname = (pathPart || "/").split("?")[0];
  expect(APP_ROUTES.has(pathname), `route not found for ${href}`).toBe(true);
  if (hash && pathname === "/") {
    expect(SECTION_IDS.has(hash), `home section #${hash} not found for ${href}`).toBe(true);
  }
}

describe("Phase 2: Navigation integrity", () => {
  it("resolves every header and footer link to a real page or home section", () => {
    const links = [...MAIN_NAV, ...FOOTER_NAV.flatMap((group) => group.links)];
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => assertInternalLinkResolves(link.href));
  });

  it("resolves every link inside the guide content", () => {
    GUIDE_SECTIONS.flatMap((section) => section.links ?? []).forEach((link) => assertInternalLinkResolves(link.href));
  });

  it("has a page for every public route listed in the sitemap", () => {
    PUBLIC_ROUTES.forEach((route) => expect(APP_ROUTES.has(route.path), route.path).toBe(true));
  });
});

describe("Phase 2: SEO", () => {
  it("builds a sitemap with absolute URLs for every indexable route and no private paths", () => {
    const entries = sitemap();
    expect(entries).toHaveLength(getIndexableRoutes(legalConfig.isDraft).length);
    entries.forEach((entry) => {
      expect(entry.url.startsWith(siteConfig.url)).toBe(true);
      const { pathname } = new URL(entry.url);
      expect(PRIVATE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))).toBe(false);
    });
  });

  it("leaves draft legal pages out of the sitemap until they are published", () => {
    const draftPaths = getIndexableRoutes(true).map((route) => route.path);
    LEGAL_PATHS.forEach((path) => expect(draftPaths).not.toContain(path));
    expect(draftPaths).toEqual(expect.arrayContaining(["/", "/features", "/guide"]));

    const publishedPaths = getIndexableRoutes(false).map((route) => route.path);
    expect(publishedPaths).toEqual(PUBLIC_ROUTES.map((route) => route.path));
  });

  it("marks draft legal pages as noindex", () => {
    [termsMetadata, privacyMetadata, refundMetadata].forEach((metadata) => {
      expect(metadata.robots).toEqual(legalConfig.isDraft ? { index: false, follow: true } : undefined);
    });
    expect(buildPageMetadata({ title: "t", description: "d", path: "/x" }).robots).toBeUndefined();
  });

  it("blocks private areas in robots.txt with bare prefixes so /admin itself is covered", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    const disallow = [rules.disallow].flat();
    expect(disallow).toEqual(["/admin", "/account", "/checkout", "/api", "/auth"]);
    expect(result.sitemap).toBe(new URL("/sitemap.xml", siteConfig.url).toString());
  });

  it("refuses to build production with a missing or localhost site URL", () => {
    expect(() => resolveSiteUrl({ VERCEL_ENV: "production" })).toThrow(/NEXT_PUBLIC_APP_URL/);
    expect(() => resolveSiteUrl({ VERCEL_ENV: "production", NEXT_PUBLIC_APP_URL: "http://localhost:3000" })).toThrow();
    expect(resolveSiteUrl({ VERCEL_ENV: "production", NEXT_PUBLIC_APP_URL: "https://peenoey.com" })).toBe("https://peenoey.com");
    expect(resolveSiteUrl({ VERCEL_ENV: "preview" })).toBe("http://localhost:3000");
    expect(resolveSiteUrl({})).toBe("http://localhost:3000");
  });

  it("sets canonical, Open Graph and Twitter metadata for a page", () => {
    const metadata = buildPageMetadata({ title: "คู่มือ", description: "รายละเอียด", path: "/guide" });
    expect(metadata.alternates?.canonical).toBe("/guide");
    expect(metadata.openGraph).toMatchObject({ title: "คู่มือ", url: "/guide", locale: "th_TH" });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("keeps the share image when a page overrides Open Graph metadata", () => {
    const metadata = buildPageMetadata({ title: "คู่มือ", description: "รายละเอียด", path: "/guide" });
    const ogImages = [metadata.openGraph?.images].flat();
    const twitterImages = [metadata.twitter?.images].flat();
    expect(ogImages).toContainEqual(expect.objectContaining({ url: siteConfig.ogImage, width: 1200, height: 630 }));
    expect(twitterImages).toContain(siteConfig.ogImage);
  });

  it("builds FAQPage JSON-LD with one entry per FAQ item", () => {
    const jsonLd = buildFaqJsonLd(FAQ_ITEMS);
    expect(jsonLd["@type"]).toBe("FAQPage");
    expect(jsonLd.mainEntity).toHaveLength(FAQ_ITEMS.length);
  });

  it("builds Product JSON-LD from real plan prices without fake ratings or reviews", () => {
    const jsonLd = buildProductJsonLd();
    expect(jsonLd.offers).toHaveLength(SITE_PLANS.length);
    expect(jsonLd).not.toHaveProperty("aggregateRating");
    expect(jsonLd).not.toHaveProperty("review");
  });

  it("escapes characters that could break out of the JSON-LD script tag", () => {
    const serialized = serializeJsonLd({ name: "</script><script>alert(1)</script>&" });
    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain(">");
    expect(serialized).not.toContain("&");
    expect(JSON.parse(serialized).name).toBe("</script><script>alert(1)</script>&");
  });
});

describe("Phase 2: Security headers on every route", () => {
  it("applies anti-clickjacking, nosniff and CSP headers to all paths", async () => {
    const routes = await nextConfig.headers!();
    const catchAll = routes.find((route) => route.source === "/:path*");
    expect(catchAll).toBeDefined();

    const headers = new Map(catchAll!.headers.map((header) => [header.key, header.value]));
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Content-Security-Policy")).toBe("frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains");
    expect(headers.get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");
  });

  it("does not advertise the framework with X-Powered-By", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});

describe("Phase 2: Content rules (CLAUDE.md §3 — no fake reviews or unprovable claims)", () => {
  const BANNED_PATTERNS = [/แม่นยำ/, /win\s?rate/i, /testimonial/i, /รีวิวจากลูกค้า/, /การันตีกำไร/, /กำไรแน่นอน/];

  const ownedContent = JSON.stringify({
    siteDescription: siteConfig.description,
    HERO_CONTENT,
    FEATURES,
    HOW_IT_WORKS,
    FAQ_ITEMS,
    FEATURE_DETAILS,
    GUIDE_SECTIONS,
    TROUBLESHOOTING,
    LEGAL_DOCUMENTS,
  });

  it.each(BANNED_PATTERNS.map((pattern) => [pattern.source, pattern] as const))(
    "does not contain banned claim pattern %s",
    (_label, pattern) => {
      expect(ownedContent).not.toMatch(pattern);
    },
  );

  it("states clearly in the FAQ that profit is not guaranteed", () => {
    expect(FAQ_ITEMS.some((item) => item.question.includes("รับประกันผลกำไร") && item.answer.startsWith("ไม่รับประกัน"))).toBe(true);
  });
});

describe("Phase 2: Payment rules stay consistent across pages", () => {
  const guideText = JSON.stringify(GUIDE_SECTIONS);
  const termsText = JSON.stringify(LEGAL_DOCUMENTS.terms);

  it("uses the shared payment window in the guide and terms", () => {
    expect(guideText).toContain(`${PAYMENT_RULES.paymentWindowMinutes} นาที`);
    expect(termsText).toContain(`${PAYMENT_RULES.paymentWindowMinutes} นาที`);
    expect(legalConfig.paymentWindowMinutes).toBe(PAYMENT_RULES.paymentWindowMinutes);
  });

  it("uses the shared slip limits and expiry reminder in the guide", () => {
    expect(guideText).toContain(`${PAYMENT_RULES.slipMaxSizeMb}MB`);
    PAYMENT_RULES.slipAllowedFormats.forEach((format) => expect(guideText).toContain(format));
    expect(guideText).toContain(`${PAYMENT_RULES.expiryReminderDays} วันก่อน`);
  });
});
