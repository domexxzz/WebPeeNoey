import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { useSession } from "next-auth/react";
import HomePage from "@/app/(marketing)/page";
import FeaturesPage from "@/app/(marketing)/features/page";
import GuidePage from "@/app/(marketing)/guide/page";
import TermsPage from "@/app/(marketing)/terms/page";
import PrivacyPage from "@/app/(marketing)/privacy/page";
import RefundPage from "@/app/(marketing)/refund/page";
import MarketingLayout from "@/app/(marketing)/layout";
import { HeaderAuth } from "@/components/marketing/header-auth";
import { MobileNav } from "@/components/marketing/mobile-nav";
import { ImageSlot } from "@/components/marketing/image-slot";
import { Phrases } from "@/components/marketing/phrases";
import { ChartDecoration } from "@/components/marketing/chart-decoration";
import { getPlanCtaHref } from "@/components/marketing/pricing-section";
import { getContactChannels } from "@/components/marketing/contact-section";
import { FAQ_ITEMS, HOME_SECTION_IDS, IMAGE_SLOTS, MAIN_NAV, RISK_DISCLAIMER } from "@/config/marketing";
import { SITE_PLANS, formatTHB } from "@/config/plans";
import { legalConfig } from "@/config/legal";
import { siteConfig } from "@/config/site";
import { FEATURE_DETAILS } from "@/content/features";
import { GUIDE_SECTIONS, TROUBLESHOOTING } from "@/content/guide";
import { LEGAL_DOCUMENTS } from "@/content/legal";

// ค่าเริ่มต้นเป็นผู้เยี่ยมชม เพราะบาง describe render หน้าตั้งแต่ตอนเก็บรายการเทสต์ (ก่อน beforeEach)
// next/font ถูกแปลงโดย compiler ของ Next.js — ในเทสต์จำลองให้คืนชื่อ class/ตัวแปรแทน
vi.mock("next/font/google", () => {
  const font = (options: { variable?: string }) => ({ className: "font-mock", variable: options.variable?.replace(/^--/, "") ?? "font-mock", style: { fontFamily: "mock" } });
  return { Familjen_Grotesk: font, Anuphan: font };
});
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({ data: null, status: "unauthenticated", update: vi.fn() })),
}));

type SessionState = ReturnType<typeof useSession>;

function mockSession(state: { status: "loading" | "authenticated" | "unauthenticated"; role?: "USER" | "ADMIN" }) {
  const data =
    state.status === "authenticated"
      ? { user: { id: "u1", name: "Test", email: "t@example.com", role: state.role ?? "USER" }, expires: "2099-01-01" }
      : null;
  vi.mocked(useSession).mockReturnValue({ data, status: state.status, update: vi.fn() } as unknown as SessionState);
}

/** ถอด HTML entity ที่ React ใส่ไว้ เพื่อเทียบข้อความภาษาไทย/สัญลักษณ์ได้ตรง */
function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
}

beforeEach(() => {
  mockSession({ status: "unauthenticated" });
});

describe("Phase 2: Home page", () => {
  const html = render(<HomePage />);

  it("renders every home section that the navigation points to", () => {
    Object.values(HOME_SECTION_IDS).forEach((id) => expect(html).toContain(`id="${id}"`));
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
  });

  it("renders every plan with its real price and a signup CTA carrying the plan slug", () => {
    SITE_PLANS.forEach((plan) => {
      expect(html).toContain(plan.name);
      expect(html).toContain(formatTHB(plan.price));
      expect(html).toContain(`href="${getPlanCtaHref(plan)}"`);
    });
    expect(getPlanCtaHref(SITE_PLANS[0])).toBe(`/checkout/${SITE_PLANS[0].slug}`);
  });

  it("renders every FAQ question and embeds Product + FAQPage structured data", () => {
    FAQ_ITEMS.forEach((item) => expect(html).toContain(item.question));
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('"@type":"Product"');
  });

  it("links pricing to the terms and refund policy and shows the risk disclaimer next to the plans", () => {
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/refund"');
    // หน้าแรกไม่รวม footer ของ layout — ข้อความนี้จึงต้องมาจากส่วนราคาเอง
    expect(html).toContain(RISK_DISCLAIMER);
  });

  it("starts each plan CTA accessible name with its visible label (WCAG 2.5.3)", () => {
    SITE_PLANS.forEach((plan) => expect(html).toContain(`aria-label="เลือกแพ็กเกจนี้: ${plan.name}`));
  });

  it("builds contact links from site config", () => {
    const channels = getContactChannels();
    expect(channels.map((channel) => channel.href)).toEqual([
      `mailto:${siteConfig.contact.email}`,
      `https://line.me/R/ti/p/${encodeURIComponent(siteConfig.contact.line)}`,
      `https://t.me/${siteConfig.contact.telegram.replace(/^@/, "")}`,
    ]);
    channels.forEach((channel) => expect(html).toContain(channel.value));
  });
});

describe("Phase 2: Marketing layout", () => {
  const html = render(
    <MarketingLayout>
      <p>content</p>
    </MarketingLayout>,
  );

  it("renders header navigation, skip link, main landmark and risk disclaimer in the footer", () => {
    MAIN_NAV.forEach((link) => expect(html).toContain(`href="${link.href}"`));
    expect(html).toContain('href="#main-content"');
    expect(html).toContain('<main id="main-content"');
    expect(html).toContain(RISK_DISCLAIMER);
    expect(html).toContain('"@type":"Organization"');
  });
});

describe("Phase 2: Header auth actions", () => {
  it("shows sign in and sign up for guests", () => {
    const html = render(<HeaderAuth />);
    expect(html).toContain('href="/auth/signin"');
    expect(html).toContain('href="/auth/signup"');
  });

  it("sends admins to the admin dashboard", () => {
    mockSession({ status: "authenticated", role: "ADMIN" });
    const html = render(<HeaderAuth />);
    expect(html).toContain('href="/admin"');
    expect(html).not.toContain('href="/auth/signup"');
  });

  it("sends members to the account dashboard", () => {
    mockSession({ status: "authenticated", role: "USER" });
    const html = render(<HeaderAuth />);
    expect(html).toContain('href="/account"');
    expect(html).not.toContain('href="/admin"');
  });

  it("renders a placeholder without links while the session is loading", () => {
    mockSession({ status: "loading" });
    const html = render(<HeaderAuth />);
    expect(html).not.toContain("<a");
    expect(html).toContain('aria-hidden="true"');
  });
});

describe("Phase 2: Mobile navigation", () => {
  it("starts closed with an accessible toggle button", () => {
    const html = render(<MobileNav links={MAIN_NAV} />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="mobile-nav-panel"');
    expect(html).not.toContain('id="mobile-nav-panel"');
  });
});

describe("Phase 2: Thai heading line breaks and decoration", () => {
  it("wraps each space-separated phrase so headings only break between phrases", () => {
    const html = render(<Phrases text="พร้อมแจ้งเตือน และคอมมูนิตี้ ในที่เดียว" />);
    expect(html.match(/<span class="inline-block max-w-full">/g)).toHaveLength(3);
    expect(html).toContain('<span class="inline-block max-w-full">และคอมมูนิตี้</span>');
  });

  it("keeps the chart decoration hidden from assistive tech and free of numbers or labels", () => {
    const html = render(<ChartDecoration />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/<text|<title/);
  });
});

describe("Phase 2: Image slots", () => {
  it("shows the required image size when no image is provided yet", () => {
    const html = render(<ImageSlot spec={IMAGE_SLOTS.heroChart} alt="กราฟตัวอย่าง" />);
    expect(html).toContain('role="img"');
    expect(html).toContain(`${IMAGE_SLOTS.heroChart.width} × ${IMAGE_SLOTS.heroChart.height} px`);
    expect(html).toContain(`aspect-ratio:${IMAGE_SLOTS.heroChart.width} / ${IMAGE_SLOTS.heroChart.height}`);
  });

  it("renders next/image with the configured sizes once an image exists", () => {
    const html = render(<ImageSlot spec={IMAGE_SLOTS.featureScreenshot} alt="ภาพจริง" src="/images/feature.webp" />);
    expect(html).toContain("<img");
    expect(html).toContain('alt="ภาพจริง"');
    expect(html).toContain(`sizes="${IMAGE_SLOTS.featureScreenshot.sizes}"`);
    expect(html).toContain(`width="${IMAGE_SLOTS.featureScreenshot.width}"`);
  });
});

describe("Phase 2: Features and guide pages", () => {
  it("renders a section with screenshot slot for every detailed feature", () => {
    const html = render(<FeaturesPage />);
    FEATURE_DETAILS.forEach(({ feature, bullets }) => {
      expect(html).toContain(`id="${feature.id}"`);
      bullets.forEach((bullet) => expect(html).toContain(bullet));
    });
    expect(html).toContain(RISK_DISCLAIMER);
  });

  it("renders every guide step with a matching table of contents entry and troubleshooting", () => {
    const html = render(<GuidePage />);
    GUIDE_SECTIONS.forEach((section) => {
      expect(html).toContain(`id="${section.id}"`);
      expect(html).toContain(`href="#${section.id}"`);
    });
    TROUBLESHOOTING.forEach((item) => expect(html).toContain(item.problem));
  });
});

describe("Phase 2: Legal pages", () => {
  const pages = [
    { slug: "terms", Page: TermsPage },
    { slug: "privacy", Page: PrivacyPage },
    { slug: "refund", Page: RefundPage },
  ] as const;

  it.each(pages)("renders $slug with title, effective date, draft notice and unique section anchors", ({ slug, Page }) => {
    const document = LEGAL_DOCUMENTS[slug];
    const html = render(<Page />);
    expect(html).toContain(document.title);
    expect(html).toContain(`dateTime="${legalConfig.effectiveDate}"`);
    if (legalConfig.isDraft) expect(html).toContain("ฉบับร่าง");

    const ids = document.sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(html).toContain(`id="${id}"`));
  });

  it("covers the PDPA essentials in the privacy policy", () => {
    const ids = LEGAL_DOCUMENTS.privacy.sections.map((section) => section.id);
    ["controller", "data-collected", "purposes", "sharing", "retention", "rights", "contact"].forEach((id) =>
      expect(ids).toContain(id),
    );
    expect(JSON.stringify(LEGAL_DOCUMENTS.privacy)).toContain("สคส.");
  });

  it("includes the investment risk disclaimer in the terms", () => {
    expect(JSON.stringify(LEGAL_DOCUMENTS.terms)).toContain(RISK_DISCLAIMER);
  });

  it("states the refund request window from config", () => {
    expect(JSON.stringify(LEGAL_DOCUMENTS.refund)).toContain(`${legalConfig.refundRequestWindowDays} วัน`);
  });
});
