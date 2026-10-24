import { INTEGRATIONS } from "@/config/integrations";

const CLOUDFLARE_BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js";

/** Cloudflare Web Analytics (ไม่ใช้คุกกี้) — โหลดแบบ defer ไม่ถ่วงการแสดงผล; ไม่มี token = ไม่โหลด */
export function AnalyticsScript({ token = INTEGRATIONS.cloudflareAnalyticsToken }: { token?: string | null }) {
  if (!token) return null;
  return <script defer src={CLOUDFLARE_BEACON_SRC} data-cf-beacon={JSON.stringify({ token })} />;
}
