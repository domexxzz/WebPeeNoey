import generatePayload from "promptpay-qr";

export type PromptPayTargetType = "PHONE" | "NATIONAL_ID" | "EWALLET";

export type PromptPayTargetResult =
  | { ok: true; target: string; type: PromptPayTargetType }
  | { ok: false; reason: string };

/**
 * ตรวจและทำความสะอาดหมายเลข PromptPay
 * - เบอร์มือถือ 10 หลัก ขึ้นต้น 06/08/09
 * - เลขบัตรประชาชน/เลขผู้เสียภาษี 13 หลัก
 * - e-Wallet ID 15 หลัก
 */
export function normalizePromptPayTarget(raw: string): PromptPayTargetResult {
  const digits = raw.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digits)) return { ok: false, reason: "PromptPay ต้องเป็นตัวเลขเท่านั้น" };
  if (digits.length === 10 && /^0[689]/.test(digits)) return { ok: true, target: digits, type: "PHONE" };
  if (digits.length === 13) return { ok: true, target: digits, type: "NATIONAL_ID" };
  if (digits.length === 15) return { ok: true, target: digits, type: "EWALLET" };
  return { ok: false, reason: "PromptPay ต้องเป็นเบอร์มือถือ 10 หลัก เลขประจำตัว 13 หลัก หรือ e-Wallet 15 หลัก" };
}

// เลขทศนิยมฐานสองคลาดเคลื่อนได้ เช่น 2489.99 * 100 = 248998.99999999997 จึงเทียบแบบมีค่าเผื่อ
const CENT_TOLERANCE = 1e-6;

function hasAtMostTwoDecimals(amount: number): boolean {
  return Math.abs(Math.round(amount * 100) - amount * 100) < CENT_TOLERANCE;
}

/** สร้าง Payload มาตรฐาน EMVCo (Thai QR / PromptPay) แบบฝังยอดเงิน */
export function buildPromptPayPayload(target: string, amount: number): string {
  const normalized = normalizePromptPayTarget(target);
  if (!normalized.ok) throw new Error(`Invalid PromptPay target: ${normalized.reason}`);
  if (!Number.isFinite(amount) || amount <= 0 || !hasAtMostTwoDecimals(amount)) {
    throw new Error("Invalid amount: must be positive with at most 2 decimal places");
  }
  return generatePayload(normalized.target, { amount: Math.round(amount * 100) / 100 });
}
