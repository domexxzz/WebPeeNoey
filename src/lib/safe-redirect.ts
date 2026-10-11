const PLACEHOLDER_ORIGIN = "http://localhost";

/** path ที่เบราว์เซอร์ตีความเป็น URL ของโดเมนอื่น ("//host" หรือ "/\host") */
function isProtocolRelative(path: string): boolean {
  return path.startsWith("//") || path.startsWith("/\\");
}

/**
 * รับ callbackUrl จาก query string อย่างปลอดภัย (กัน Open Redirect)
 * ยอมรับเฉพาะ path ภายในเว็บที่ขึ้นต้นด้วย "/" — ไม่รับ URL ภายนอก, "//host", "/\host" หรือ "javascript:"
 * ตรวจซ้ำหลัง normalize ด้วย เพราะ "/.//evil.com" หรือ "/%2e//evil.com" จะกลายเป็น "//evil.com"
 */
export function safeCallbackUrl(raw: string | null | undefined, fallback = "/account"): string {
  if (!raw || !raw.startsWith("/") || isProtocolRelative(raw)) return fallback;
  try {
    const url = new URL(raw, PLACEHOLDER_ORIGIN);
    if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
    const normalized = `${url.pathname}${url.search}${url.hash}`;
    return isProtocolRelative(normalized) ? fallback : normalized;
  } catch {
    return fallback;
  }
}
