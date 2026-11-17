/**
 * ไฟล์แจกสำหรับสมาชิก — ตอนนี้มีตารางบันทึกสถิติการเทรด (Trading Journal) ที่เจ้าของทำไว้บน Google ชีต
 * ไฟล์ต้นฉบับแชร์แบบ "ใครมีลิงก์ก็ดูได้ (ดูอย่างเดียว)" สมาชิกจึงคัดลอกไปไว้ในไดรฟ์ตัวเองได้ แต่แก้ไฟล์ต้นฉบับไม่ได้
 *
 * หมายเหตุเรื่องความคาดหวัง: ลิงก์นี้เป็นลิงก์สาธารณะ ใครได้ลิงก์ต่อไปก็เปิดได้แม้ไม่ได้เป็นสมาชิก
 * การ์ดนี้แสดงเฉพาะสมาชิกที่มีสิทธิ์ใช้งานอยู่ แต่ไม่ได้ป้องกันการส่งลิงก์ต่อ
 */

/** id ของไฟล์ Google ชีต (ตัวอักษร ตัวเลข ขีด และขีดล่าง) */
const SHEET_ID_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;
const SHEET_URL_PATTERN = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,100})(?:\/|$|\?)/;

const DEFAULT_SHEET_ID = "1JjmGzY--WsD4de2Zk0as5C5YxrRSO65L";

/**
 * รับได้ทั้ง id ตรง ๆ และลิงก์เต็มจาก Google ชีต (ลิงก์ที่ก๊อปจากเบราว์เซอร์มี /edit?usp=... ต่อท้ายเสมอ
 * และบางครั้งมี ouid ซึ่งผูกกับบัญชีของคนก๊อป — ตัดทิ้งทั้งหมด เหลือแค่ id)
 */
export function normalizeSheetId(raw: string | undefined | null): string | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  const fromUrl = SHEET_URL_PATTERN.exec(value);
  if (fromUrl) return fromUrl[1];
  return SHEET_ID_PATTERN.test(value) ? value : null;
}

export interface TradingJournalResource {
  /** เปิดหน้า "ทำสำเนา" ของ Google ชีต — ต้องล็อกอิน Google เพราะสำเนาไปอยู่ในไดรฟ์ของผู้ใช้ */
  copyUrl: string;
  /** โหลดเป็นไฟล์ .xlsx ได้เลยโดยไม่ต้องล็อกอิน สำหรับคนที่ใช้ Excel */
  xlsxUrl: string;
  /** เปิดดูเฉย ๆ ก่อนตัดสินใจ */
  previewUrl: string;
}

export function buildTradingJournal(sheetId: string | null): TradingJournalResource | null {
  if (!sheetId) return null;
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}`;
  return {
    copyUrl: `${base}/copy`,
    xlsxUrl: `${base}/export?format=xlsx`,
    previewUrl: `${base}/preview`,
  };
}

/** ตั้ง NEXT_PUBLIC_TRADING_JOURNAL_SHEET เพื่อเปลี่ยนไฟล์โดยไม่ต้องแก้โค้ด (ใส่ id หรือลิงก์เต็มก็ได้) */
export const TRADING_JOURNAL = buildTradingJournal(
  normalizeSheetId(process.env.NEXT_PUBLIC_TRADING_JOURNAL_SHEET) ?? DEFAULT_SHEET_ID,
);

/** ภาพปกที่เจ้าของทำไว้ (เวอร์ชันโทนขาว-ทองของแบรนด์) — ย่อเหลือ 900px เก็บเป็น webp */
export const TRADING_JOURNAL_IMAGE = {
  src: "/images/resources/trading-journal.webp",
  width: 900,
  height: 900,
  sizes: "(min-width: 640px) 220px, 100vw",
  alt: "ภาพปกตารางบันทึกสถิติการเทรดของ Gold HybridShot AI แสดงหัวข้อที่บันทึกได้ เช่น วันเวลา สินทรัพย์ ทิศทาง กลยุทธ์ ราคาเข้า SL TP ขนาด Lot ผลลัพธ์ ความเสี่ยง และ R-Multiple",
} as const;

export const TRADING_JOURNAL_COPY = {
  title: "ตารางบันทึกสถิติการเทรด",
  description:
    "ไฟล์ Google ชีตสำหรับบันทึกทุกออเดอร์ของคุณเอง มีหน้า Dashboard สรุปอัตราชนะและกำไรสุทธิให้อัตโนมัติ",
  bullets: [
    "บันทึกวันเวลา สินทรัพย์ ทิศทาง กลยุทธ์ ราคาเข้า SL TP และผลลัพธ์",
    "ช่องความเสี่ยง (%) และ R-Multiple สำหรับวัดวินัยการคุมความเสี่ยง",
    "หน้า Dashboard สรุปภาพรวมให้เอง ไม่ต้องคำนวณเอง",
  ],
  copyLabel: "คัดลอกไปไว้ใน Google ชีตของฉัน",
  xlsxLabel: "ดาวน์โหลดไฟล์ Excel",
  previewLabel: "เปิดดูก่อน",
  note: "การคัดลอกต้องล็อกอินบัญชี Google ถ้าใช้ Excel ให้ดาวน์โหลดไฟล์ .xlsx แทน",
} as const;
