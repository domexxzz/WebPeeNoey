/**
 * ตรวจ "ผู้รับเงิน" และ "ความสดของสลิป" (ฟังก์ชันล้วน — พอร์ตจาก Tradepulse src/lib/slip-receiver.ts)
 *
 * ยอดตรงอย่างเดียวไม่พอ: โอนยอดตรงเข้าบัญชีใครก็ได้แล้วอัปสลิป หรือเอาสลิปเก่ายอดเท่ากันมาใช้
 * สองด่านนี้จึงต้องมีก่อนจะเชื่อผลตรวจอัตโนมัติ
 */

/** ยอมให้สลิปเก่ากว่าเวลาสร้างออเดอร์ได้เท่านี้ (นาฬิกาธนาคาร/เซิร์ฟเวอร์คลาดกัน) */
export const SLIP_BACKDATE_GRACE_MS = 30 * 60 * 1000;
/** ยอมให้สลิปใหม่กว่าเวลาปัจจุบันได้เท่านี้ (นาฬิกาธนาคารเดินเร็ว) */
export const SLIP_FUTURE_GRACE_MS = 30 * 60 * 1000;
/** ต้องมีเลขจริง (ไม่ใช่ x) ตรงกันอย่างน้อยเท่านี้ ไม่งั้น "xxxxxxxx" จะผ่านทุกกรณี */
const MIN_REAL_DIGITS = 4;

/** เหลือเฉพาะตัวเลขกับตัวปิดบัง x — สลิปไทยปิดบังเลขบัญชีเสมอ เช่น "xxx-x-x1234-x" */
export function normalizeAccountRef(raw: string): string {
  return raw.toLowerCase().replace(/[^0-9x]/g, "");
}

/**
 * เลขบัญชีบนสลิปเข้ากันได้กับเลขที่เราตั้งไว้หรือไม่ — เทียบชิดขวา (สลิปมักเหลือเลขท้าย)
 * ตำแหน่งที่ฝั่งใดฝั่งหนึ่งเป็น x = ข้าม, ตำแหน่งที่เป็นเลขทั้งคู่ = ต้องตรงเป๊ะ
 */
export function accountRefMatches(configuredId: string, slipRef: string): boolean {
  const want = normalizeAccountRef(configuredId);
  const got = normalizeAccountRef(slipRef);
  if (!want || !got) return false;
  let realDigits = 0;
  for (let i = 1; i <= Math.min(want.length, got.length); i++) {
    const w = want[want.length - i];
    const g = got[got.length - i];
    if (w === "x" || g === "x") continue;
    if (w !== g) return false;
    realDigits++;
  }
  return realDigits >= MIN_REAL_DIGITS;
}

/** เงินเข้าบัญชีเราไหม — เทียบทั้งช่อง PromptPay และเลขบัญชี ผ่านช่องใดก็พอ (แต่ละธนาคารใส่ข้อมูลไม่เหมือนกัน) */
export function receiverMatches(configuredIds: string[], slipRefs: (string | null | undefined)[]): boolean {
  return configuredIds.some((id) => id && slipRefs.some((ref) => typeof ref === "string" && accountRefMatches(id, ref)));
}

// คำนำหน้าต้องตามด้วยช่องว่างหรือลงท้ายด้วยจุด — ไม่งั้น "นาย" จะกินชื่อที่ขึ้นต้นด้วย "นาย..." เช่น "นายิกา"
const NAME_TITLES = /^(?:(?:นางสาว|นาง|นาย|miss|mrs|mr|ms)\s+|(?:น\.ส\.|ด\.ช\.|ด\.ญ\.|mrs\.|mr\.|ms\.)\s*)/i;

/** ชื่อ → [ชื่อต้น, นามสกุล(หรือส่วนที่โชว์)] ตัดคำนำหน้า/จุด แล้วตัวพิมพ์เล็ก */
function nameParts(raw: string): string[] {
  return raw.trim().toLowerCase().replace(NAME_TITLES, "").replace(/\./g, " ").split(/\s+/).filter(Boolean);
}

export type NameMatch = "MATCH" | "MISMATCH" | "UNKNOWN";

/**
 * ชื่อผู้รับบนสลิปตรงกับชื่อบัญชีที่ตั้งไว้ไหม — สลิปมักย่อนามสกุล เช่น "นาย จักรพงษ์ ม" เทียบกับ "นาย จักรพงษ์ มูลวิชา"
 * ต้องการเพราะเลขบัญชีบนสลิปโชว์แค่ ~4 หลักท้าย: ใครหาบัญชี/เบอร์ที่ลงท้ายเหมือนเราได้ก็ผ่านด่านเลขอย่างเดียว
 * ฝั่งใดไม่มีชื่อ หรือคนละภาษา (ไทย/อังกฤษ) = UNKNOWN (เทียบไม่ได้ ไม่ใช่ผิด)
 */
export function receiverNameMatches(slipName: string | null | undefined, accountName: string | null | undefined): NameMatch {
  if (!slipName?.trim() || !accountName?.trim()) return "UNKNOWN";
  const thai = /[฀-๿]/;
  if (thai.test(slipName) !== thai.test(accountName)) return "UNKNOWN";
  const [slipFirst, slipLast = ""] = nameParts(slipName);
  const [accountFirst, accountLast = ""] = nameParts(accountName);
  if (!slipFirst || !accountFirst || slipFirst !== accountFirst) return "MISMATCH";
  return !slipLast || accountLast.startsWith(slipLast) ? "MATCH" : "MISMATCH";
}

/** การโอนต้องเกิดหลังสร้างออเดอร์ (เผื่อ grace ทั้งสองด้าน) — กันสลิปเก่าที่ขุดมาใช้ */
export function isSlipFresh(slipDate: Date, orderCreatedAt: Date, now: Date): boolean {
  const time = slipDate.getTime();
  if (!Number.isFinite(time)) return false;
  return time >= orderCreatedAt.getTime() - SLIP_BACKDATE_GRACE_MS && time <= now.getTime() + SLIP_FUTURE_GRACE_MS;
}

export function parseSlipDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}
