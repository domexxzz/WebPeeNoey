const TIME_ZONE = "Asia/Bangkok";

export function formatBaht(amount: number): string {
  return new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(date);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: TIME_ZONE }).format(date);
}

const MAX_PAGE = 10_000;

/** แปลงเลขหน้าจาก query string ให้ปลอดภัย (จำนวนเต็ม 1–10,000) */
export function parsePage(raw: string | undefined): number {
  const page = Number(raw);
  if (!Number.isSafeInteger(page) || page < 1) return 1;
  return Math.min(page, MAX_PAGE);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** จำนวนวันที่เหลือ (ปัดขึ้น) — ใช้แสดงอายุสมาชิก */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}
