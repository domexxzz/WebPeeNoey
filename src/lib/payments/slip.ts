import { PAYMENT_RULES } from "@/config/payment";

export type SlipMimeType = "image/jpeg" | "image/png" | "image/webp";

export type SlipValidationResult =
  | { ok: true; mimeType: SlipMimeType }
  | { ok: false; code: "EMPTY_FILE" | "FILE_TOO_LARGE" | "UNSUPPORTED_TYPE" };

const MAX_BYTES = PAYMENT_RULES.slipMaxSizeMb * 1024 * 1024;

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/** ตรวจชนิดไฟล์จาก Magic Bytes ที่หัวไฟล์ — ไม่เชื่อนามสกุลหรือ Content-Type ที่ผู้ใช้ส่งมา */
export function detectImageMime(bytes: Uint8Array): SlipMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // RIFF....WEBP
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

export function validateSlipFile(bytes: Uint8Array): SlipValidationResult {
  if (bytes.length === 0) return { ok: false, code: "EMPTY_FILE" };
  if (bytes.length > MAX_BYTES) return { ok: false, code: "FILE_TOO_LARGE" };
  const mimeType = detectImageMime(bytes);
  if (!mimeType) return { ok: false, code: "UNSUPPORTED_TYPE" };
  return { ok: true, mimeType };
}
