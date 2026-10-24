import jsQR from "jsqr";
// sharp ประกาศชนิดไว้ใน namespace ของ export = ต้องดึงชนิดแยกจากค่า
import sharp, { type Sharp } from "sharp";
import { checkQrIntegrity, extractQrReference, type QrIntegrity } from "./slip-qr-payload";

/**
 * อ่าน QR ที่ธนาคารฝังไว้ในสลิป — ตัวอ่าน QR ทำงานในเซิร์ฟเวอร์เราเอง (พอร์ตจาก Tradepulse src/lib/slip-qr.ts)
 * (รูปสลิปถูกส่งให้ EasySlip เฉพาะตอนอ่าน QR เองไม่ได้ — ดู easyslip.ts)
 *
 * ทำไมต้องมี: hash ของไฟล์จับได้แค่ "ไฟล์เดิม" — ถ่ายรูปสลิปเดิมใหม่/ครอปใหม่/แคปใหม่ hash เปลี่ยน
 * แต่ค่าใน QR ผูกกับ "รายการโอน" จึงเท่าเดิมเสมอ ใช้ payload ทั้งก้อนเป็นกุญแจกันซ้ำได้โดยไม่ต้องรู้สเปกของแต่ละธนาคาร
 *
 * ⚠️ ทั้งหมดนี้รันบน request ของลูกค้า บนเครื่อง 512MB:
 * - sharp (libvips) ทำงานนอก event loop แต่ jsQR เป็น JS ล้วนแบบ synchronous — เวลาแปรตามจำนวนพิกเซล
 *   ภาพ noise 1400×3100 ใช้ ~12 วินาที (วัดจริงตอนรีวิว) จึงจำกัดทุกชั้นไม่เกิน MAX_DECODE_PIXELS
 * - ภาพผอมสูง (เช่น 10×1600) ขยายตามความกว้างแล้วกลายเป็นหลาย GB — ทุกการ resize ต้องมีกรอบทั้งกว้างและสูง
 * - ถอดได้ทีละภาพทั้งเครื่อง + งบเวลารวม — เกินงบ = ถือว่าอ่านไม่ได้ (ยังกันซ้ำด้วย hash และส่งรูปให้ EasySlip อ่านแทนได้)
 */

export type SlipQrResult =
  | { found: true; payload: string; reference?: string; integrity: QrIntegrity; strategy: string }
  | { found: false };

/** กันภาพยักษ์ตั้งแต่ตอนถอดรหัสไฟล์ (decompression bomb) */
const LIMIT_INPUT_PIXELS = 25_000_000;
/** สลิปจริงเป็นแนวตั้ง ~9:16 แคปยาวไม่เกิน ~1:5 — ผอม/กว้างเกินนี้ไม่ใช่สลิป */
const MAX_ASPECT_RATIO = 6;
const MIN_EDGE = 200;
/** ขนาดภาพเต็มที่ใช้ถอด ~0.7MP — QR ในสลิปยังกว้าง ~150px พอให้ jsQR อ่านได้ */
const FULL_BOX = { width: 720, height: 1280 };
/** ครึ่งล่างของสลิป (ที่อยู่ของ QR) ขยายได้ละเอียดขึ้นในกรอบเดียวกัน */
const BOTTOM_BOX = { width: 1000, height: 900 };
const BOTTOM_CROP_RATIO = 0.45;
const MAX_DECODE_PIXELS = 1_000_000;
/** งบเวลารวมต่อสลิป (รวมเวลารอคิว) — เกินแล้วหยุดลองชั้นถัดไป */
const TIME_BUDGET_MS = 3_000;
/** payload ยาวผิดปกติไม่ใช่ QR สลิป และไม่ควรเก็บเป็นคีย์ unique */
const MAX_PAYLOAD_LENGTH = 512;

// libvips ใช้ thread เดียวพอ — เครื่อง 512MB หลาย thread = หลายบัฟเฟอร์พร้อมกัน
sharp.concurrency(1);

interface Attempt {
  name: string;
  region: "full" | "bottom";
  build: (image: Sharp) => Sharp;
}

/**
 * ไล่จากถูกไปแพง เจอเมื่อไหร่หยุด — แต่ละชั้นแก้ปัญหาที่เจอจริงกับสลิปจากมือถือ
 * ห้ามใช้ grayscale(): เหลือ 1 channel แล้ว ensureAlpha ได้ 2 ช่อง ตัวถอด QR ต้องการ RGBA ครบ 4
 */
const ATTEMPTS: Attempt[] = [
  { name: "native", region: "full", build: (image) => image },
  { name: "bottom", region: "bottom", build: (image) => image },
  { name: "sharpen", region: "bottom", build: (image) => image.normalize().sharpen() },
  { name: "threshold", region: "bottom", build: (image) => image.threshold(140, { greyscale: false }) },
  // แคปจากโหมดมืด (QR สีกลับ) — กลับสีด้วย sharp แล้วอ่านแบบปกติ
  // (inversionAttempts "onlyInvert" ของ jsQR 1.4 พังด้วย "reading 'height'" กับภาพบางแบบ — อย่าเปลี่ยนไปใช้)
  { name: "negate", region: "full", build: (image) => image.negate({ alpha: false }) },
];

const input = (buffer: Buffer) => sharp(buffer, { failOn: "none", limitInputPixels: LIMIT_INPUT_PIXELS });

/** คิวถอดรหัสทีละภาพทั้งโปรเซส — jsQR บล็อก event loop จึงห้ามรันซ้อนกัน */
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function decodeWith(buffer: Buffer, attempt: Attempt, size: { width: number; height: number }): Promise<string | null> {
  let pipeline = input(buffer);
  if (attempt.region === "bottom") {
    const top = Math.floor(size.height * BOTTOM_CROP_RATIO);
    pipeline = pipeline.extract({ left: 0, top, width: size.width, height: size.height - top });
  }
  const box = attempt.region === "bottom" ? BOTTOM_BOX : FULL_BOX;
  // fit: inside + กรอบทั้งสองด้าน = ขนาดผลลัพธ์มีเพดานเสมอ ไม่ว่าภาพต้นทางจะผอมแค่ไหน
  const resized = attempt.build(pipeline.resize({ ...box, fit: "inside", withoutEnlargement: attempt.region === "full" }));
  // บังคับ sRGB ก่อน ensureAlpha เสมอ ไม่งั้นได้ "Malformed data passed to binarizer"
  const { data, info } = await resized.toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width * info.height > MAX_DECODE_PIXELS) return null;
  // ไม่ให้ jsQR ลองกลับสีเอง (ประหยัดเวลาครึ่งหนึ่ง) — ภาพโหมดมืดมีชั้น negate แยกแล้ว
  const code = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height, { inversionAttempts: "dontInvert" });
  const text = code?.data?.trim();
  return text ? text : null;
}

/** หมุนตาม EXIF ครั้งเดียวและตรวจรูปทรง — รูปทรงไม่ใช่สลิป/อ่านไฟล์ไม่ได้ = null (ไม่ลองถอดเลย) */
async function prepare(bytes: Uint8Array): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  try {
    const { data, info } = await input(Buffer.from(bytes)).rotate().resize({ width: 1600, height: 3200, fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 1 }).toBuffer({ resolveWithObject: true });
    const { width, height } = info;
    if (Math.min(width, height) < MIN_EDGE || Math.max(width, height) / Math.min(width, height) > MAX_ASPECT_RATIO) return null;
    return { buffer: data, width, height };
  } catch {
    return null;
  }
}

/**
 * อ่าน QR จากสลิป — ไม่ throw: อ่านไม่ได้ถือเป็นเรื่องปกติ (บางธนาคารไม่มี QR) ระบบยังกันซ้ำด้วย hash ได้เหมือนเดิม
 */
export function readSlipQr(bytes: Uint8Array, { timeBudgetMs = TIME_BUDGET_MS }: { timeBudgetMs?: number } = {}): Promise<SlipQrResult> {
  const deadline = Date.now() + timeBudgetMs;
  return exclusive(async (): Promise<SlipQrResult> => {
    if (bytes.length === 0 || Date.now() >= deadline) return { found: false };
    const prepared = await prepare(bytes);
    if (!prepared) return { found: false };
    for (const attempt of ATTEMPTS) {
      if (Date.now() >= deadline) break;
      try {
        const payload = await decodeWith(prepared.buffer, attempt, prepared);
        if (payload && payload.length <= MAX_PAYLOAD_LENGTH) {
          return { found: true, payload, reference: extractQrReference(payload), integrity: checkQrIntegrity(payload), strategy: attempt.name };
        }
      } catch (error) {
        // ชั้นนี้พังก็ลองชั้นถัดไป
        console.warn("[slip-qr] attempt failed", attempt.name, error instanceof Error ? error.message : error);
      }
    }
    return { found: false };
  });
}
