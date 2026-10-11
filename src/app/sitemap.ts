import type { MetadataRoute } from "next";
import { legalConfig } from "@/config/legal";
import { absoluteUrl, getIndexableRoutes } from "@/lib/seo";

// ไม่ใส่ lastModified: ถ้าใช้เวลา build ทุกหน้าจะดูเหมือนแก้ไขพร้อมกัน ซึ่ง Search Engine ไม่เชื่อถือ
export default function sitemap(): MetadataRoute.Sitemap {
  return getIndexableRoutes(legalConfig.isDraft).map((route) => ({
    url: absoluteUrl(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
