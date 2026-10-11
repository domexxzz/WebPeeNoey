import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { SITE_PLANS } from "@/config/plans";
import { IMAGE_SLOTS, type FaqItem } from "@/config/marketing";

export interface PublicRoute {
  path: string;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
}

/** หน้าสาธารณะที่ให้ Search Engine เก็บข้อมูล (ใช้สร้าง sitemap.xml) */
export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/features", changeFrequency: "monthly", priority: 0.8 },
  { path: "/guide", changeFrequency: "monthly", priority: 0.7 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/refund", changeFrequency: "yearly", priority: 0.3 },
];

export const LEGAL_PATHS = ["/terms", "/privacy", "/refund"];

/** หน้านโยบายฉบับร่างยังไม่ควรถูกเก็บข้อมูล จึงตัดออกจาก sitemap จนกว่าจะเผยแพร่จริง */
export function getIndexableRoutes(isLegalDraft: boolean): PublicRoute[] {
  return isLegalDraft ? PUBLIC_ROUTES.filter((route) => !LEGAL_PATHS.includes(route.path)) : PUBLIC_ROUTES;
}

/**
 * เส้นทางที่ห้าม Search Engine เก็บข้อมูล (ใช้ใน robots.txt)
 * ห้ามมี "/" ต่อท้าย — "Disallow: /admin/" ไม่ครอบคลุมหน้า "/admin" เอง
 */
export const PRIVATE_PATH_PREFIXES = ["/admin", "/account", "/checkout", "/api", "/auth"];

export function absoluteUrl(path: string): string {
  return new URL(path, siteConfig.url).toString();
}

interface PageMetadataInput {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}

/**
 * ต้องระบุรูปแชร์เองทุกหน้า: เมื่อหน้าย่อยกำหนด openGraph เอง Next.js จะเขียนทับ
 * รูปที่สร้างจาก opengraph-image ของ root ทำให้หน้านั้นไม่มี og:image
 */
const SHARE_IMAGE = {
  url: siteConfig.ogImage,
  width: IMAGE_SLOTS.ogImage.width,
  height: IMAGE_SLOTS.ogImage.height,
  alt: siteConfig.name,
};

export function buildPageMetadata({ title, description, path, noIndex = false }: PageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: "website",
      locale: "th_TH",
      siteName: siteConfig.name,
      title,
      description,
      url: path,
      images: [SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [siteConfig.ogImage],
    },
  };
}

type JsonLd = Record<string, unknown>;

export function buildOrganizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    email: siteConfig.contact.email,
  };
}

/** ข้อมูลสินค้าและราคาจริงจาก config — ห้ามใส่ aggregateRating/review จนกว่าจะมีรีวิวจริง */
export function buildProductJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: siteConfig.name,
    description: siteConfig.description,
    brand: { "@type": "Brand", name: siteConfig.name },
    offers: SITE_PLANS.map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      price: plan.price.toFixed(2),
      priceCurrency: "THB",
      availability: "https://schema.org/InStock",
      url: absoluteUrl("/#pricing"),
    })),
  };
}

export function buildFaqJsonLd(items: FaqItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** แปลง JSON-LD เป็นสตริงที่ปลอดภัยต่อการฝังใน <script> (กันการปิดแท็กก่อนกำหนด) */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
