import { redactSensitive } from "@/lib/redact";
import { isSlipFresh, parseSlipDate, receiverMatches, receiverNameMatches } from "./slip-receiver";

/**
 * ตรวจสลิปกับธนาคารผ่าน EasySlip API v2 (POST /v2/verify/bank — https://document.easyslip.com/en/v2/verify/bank)
 * พอร์ตแนวคิดจาก Tradepulse src/lib/slip-verify.ts (ที่นั่นใช้ v1) — ต่างกันตรง:
 * - ส่ง "payload ของ QR" ที่อ่านได้ในเครื่องเรา แทนรูปสลิป (รูปออกนอกระบบเฉพาะตอนอ่าน QR เองไม่ได้)
 * - เทียบยอดถึงหลักสตางค์ เพราะทุกออเดอร์บวกเศษสตางค์สุ่มไว้แยกยอดโอน
 *
 * ห้าม throw — ทุกความล้มเหลวคืนสถานะให้แอดมินตรวจด้วยตา; PENDING = ลองใหม่ได้ (งาน slip-recheck ตรวจซ้ำให้)
 */

export const EASYSLIP_VERIFY_URL = "https://api.easyslip.com/v2/verify/bank";
/** EasySlip รับ payload 1–128 ตัว ยาวกว่านี้ส่งรูปแทน */
const MAX_PAYLOAD_LENGTH = 128;
const DEFAULT_TIMEOUT_MS = 10_000;

export type SlipCheckStatus =
  | "DISABLED" // ยังไม่ได้ตั้ง EASYSLIP_TOKEN
  | "PENDING" // ยังตอบไม่ได้ตอนนี้ (สลิปกรุงเทพยังไม่เข้าระบบ / ถูกจำกัดอัตรา / เน็ตสะดุด) — ตรวจซ้ำอัตโนมัติ
  | "VERIFIED" // ธนาคารยืนยัน: ยอดตรง บัญชีผู้รับตรง และโอนหลังสร้างออเดอร์
  | "AMOUNT_MISMATCH"
  | "WRONG_RECEIVER"
  | "RECEIVER_UNVERIFIED" // ยอดตรง เลขท้ายบัญชีตรง แต่เทียบชื่อผู้รับไม่ได้ — คนต้องดูชื่อเอง
  | "STALE" // ยอดและบัญชีตรง แต่โอนก่อนสร้างออเดอร์นี้นานเกินไป
  | "UNREADABLE" // ธนาคาร/ผู้ให้บริการหาสลิปนี้ไม่เจอ หรือข้อมูลไม่ครบ
  | "ERROR" // ผู้ให้บริการปฏิเสธคำขอ (token ผิด/โควตาหมด) หรือตรวจซ้ำครบจำนวนแล้ว
  | "DUPLICATE"; // เลขอ้างอิงรายการนี้ถูกใช้กับสลิปอื่นแล้ว (เจอตอนตรวจซ้ำ)

export interface SlipCheckResult {
  status: SlipCheckStatus;
  note: string;
  transRef?: string;
  amount?: number;
  slipDate?: Date;
  receiverName?: string;
  /** ปัญหาฝั่งระบบที่แอดมินต้องรู้ทันที (เช่น token ผิด โควตาหมด) */
  alertAdmins?: boolean;
}

export interface SlipCheckInput {
  qrPayload?: string;
  image: { bytes: Uint8Array; mimeType: string };
  expectedAmount: number;
  orderCreatedAt: Date;
  /** เลขพร้อมเพย์ของออเดอร์ + SLIP_RECEIVER_ACCOUNTS */
  receiverIds: string[];
  /** ชื่อบัญชีรับเงิน ณ เวลาสร้าง QR (Payment.promptpayAccountName) */
  receiverAccountName: string;
  now: Date;
}

interface EasySlipDeps {
  token: string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const RETRYABLE_CODES = new Set(["SLIP_PENDING", "RATE_LIMIT_EXCEEDED"]);
/** โควตาหมด/ถูกระงับชั่วคราว — แจ้งแอดมินและตรวจซ้ำต่อ (เติมโควตาแล้วสลิปที่ค้างตรวจผ่านเองได้) */
const QUOTA_STATUSES = new Set([402, 403]);
/** ข้อความจากผู้ให้บริการเก็บลงฐานข้อมูล/ส่ง Telegram — ตัดสั้นและลบสิ่งที่หน้าตาเหมือนความลับ */
const providerText = (text: string | undefined) => (text ? redactSensitive(text).slice(0, 120) : undefined);

type Json = Record<string, unknown>;
const asObject = (value: unknown): Json | undefined => (value && typeof value === "object" ? (value as Json) : undefined);
const asString = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const asNumber = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

const toSatang = (baht: number) => Math.round(baht * 100);
const formatBaht = (baht: number) => baht.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ประเมินข้อมูลสลิปที่ธนาคารยืนยันแล้ว เทียบกับออเดอร์ (ฟังก์ชันล้วน) */
export function evaluateVerifiedSlip(data: Json, input: Omit<SlipCheckInput, "qrPayload" | "image">): SlipCheckResult {
  const raw = asObject(data.rawSlip) ?? {};
  const transRef = asString(raw.transRef);
  const amount = asNumber(asObject(raw.amount)?.amount) ?? asNumber(data.amountInSlip);
  const slipDate = parseSlipDate(raw.date) ?? undefined;
  const receiverAccount = asObject(asObject(raw.receiver)?.account);
  const receiverName = asString(asObject(receiverAccount?.name)?.th) ?? asString(asObject(receiverAccount?.name)?.en);
  const base = { transRef, amount, slipDate, receiverName };

  if (amount === undefined || !transRef) return { status: "UNREADABLE", note: "ผู้ให้บริการตอบข้อมูลสลิปไม่ครบ (ไม่มียอดหรือเลขอ้างอิง)", ...base };
  if (toSatang(amount) !== toSatang(input.expectedAmount)) {
    return { status: "AMOUNT_MISMATCH", note: `ยอดในสลิป ${formatBaht(amount)} บาท ไม่ตรงกับออเดอร์ ${formatBaht(input.expectedAmount)} บาท`, ...base };
  }

  const slipRefs = [asString(asObject(receiverAccount?.bank)?.account), asString(asObject(receiverAccount?.proxy)?.account)];
  // matchedAccount = บัญชีที่ผูกไว้ในระบบ EasySlip ตรงกับผู้รับ (มีเมื่อเจ้าของลงทะเบียนบัญชีไว้ที่นั่น) — เชื่อได้เต็มที่
  const matchedByProvider = asObject(data.matchedAccount) !== undefined;
  if (!matchedByProvider) {
    const shown = slipRefs.filter(Boolean).join(" / ") || "ไม่มีเลขบัญชีในสลิป";
    if (!receiverMatches(input.receiverIds, slipRefs)) {
      return { status: "WRONG_RECEIVER", note: `ยอดตรง แต่บัญชีผู้รับในสลิป (${shown}) ไม่ตรงกับบัญชีรับเงินที่ตั้งไว้`, ...base };
    }
    // เลขบนสลิปโชว์แค่ ~4 หลักท้าย — ต้องมีชื่อผู้รับยืนยันอีกชั้นถึงจะนับว่าเงินเข้าบัญชีเรา
    const name = receiverNameMatches(receiverName, input.receiverAccountName);
    if (name === "MISMATCH") {
      return { status: "WRONG_RECEIVER", note: `เลขท้ายบัญชีตรง แต่ชื่อผู้รับในสลิป (${receiverName}) ไม่ตรงกับชื่อบัญชี (${input.receiverAccountName})`, ...base };
    }
    if (name === "UNKNOWN") {
      return { status: "RECEIVER_UNVERIFIED", note: `ยอดตรงและเลขท้ายบัญชีตรง (${shown}) แต่เทียบชื่อผู้รับไม่ได้ — ดูชื่อผู้รับในสลิปเอง`, ...base };
    }
  }

  // ไม่มีวันที่ก็ยังให้ผ่าน: transRef เป็น unique สลิปหนึ่งใบใช้ได้ครั้งเดียวทั้งระบบอยู่แล้ว
  if (slipDate && !isSlipFresh(slipDate, input.orderCreatedAt, input.now)) {
    return { status: "STALE", note: "ยอดและบัญชีตรง แต่เวลาโอนในสลิปอยู่นอกช่วงเวลาของออเดอร์นี้", ...base };
  }
  return { status: "VERIFIED", note: "ธนาคารยืนยันแล้ว: ยอดตรง บัญชีผู้รับตรง และโอนหลังสร้างออเดอร์", ...base };
}

/** แปลงคำตอบที่ไม่สำเร็จ (HTTP/โค้ดของผู้ให้บริการ) เป็นสถานะ */
export function classifyEasySlipFailure(httpStatus: number, rawCode: string | undefined, rawMessage: string | undefined): SlipCheckResult {
  const code = providerText(rawCode);
  const message = providerText(rawMessage);
  const detail = code ?? `HTTP ${httpStatus}`;
  if (code === "SLIP_PENDING") {
    return { status: "PENDING", note: "ธนาคารกรุงเทพยังไม่อัปเดตข้อมูลสลิป (โอนไม่ถึง 5 นาที) — ระบบจะตรวจซ้ำให้เอง" };
  }
  if ((code && RETRYABLE_CODES.has(code)) || httpStatus === 429 || httpStatus >= 500) {
    return { status: "PENDING", note: `ผู้ให้บริการตรวจสลิปยังตอบไม่ได้ (${detail}) — ระบบจะตรวจซ้ำให้เอง` };
  }
  if (QUOTA_STATUSES.has(httpStatus)) {
    return { status: "PENDING", note: `ผู้ให้บริการตรวจสลิประงับคำขอ (${detail}${message ? `: ${message}` : ""}) — ตรวจโควตา EasySlip ระบบจะตรวจซ้ำให้เอง`, alertAdmins: true };
  }
  if (httpStatus === 401) {
    return { status: "ERROR", note: `ผู้ให้บริการตรวจสลิปไม่รับ token (${detail}) — ตรวจ EASYSLIP_TOKEN`, alertAdmins: true };
  }
  return { status: "UNREADABLE", note: `ธนาคารหาสลิปนี้ไม่เจอหรืออ่านไม่ได้ (${detail}) — ตรวจด้วยตา` };
}

function buildRequestBody(input: SlipCheckInput): { body: BodyInit; headers: Record<string, string> } {
  if (input.qrPayload && input.qrPayload.length <= MAX_PAYLOAD_LENGTH) {
    return { body: JSON.stringify({ payload: input.qrPayload }), headers: { "Content-Type": "application/json" } };
  }
  // อ่าน QR ในเครื่องไม่ได้ — ส่งรูปให้ผู้ให้บริการอ่านแทน (FormData ตั้ง Content-Type + boundary เอง)
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(input.image.bytes)], { type: input.image.mimeType }), "slip");
  return { body: form, headers: {} };
}

export async function checkSlipWithEasySlip(input: SlipCheckInput, { token, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }: EasySlipDeps): Promise<SlipCheckResult> {
  if (!token) return { status: "DISABLED", note: "ยังไม่ได้เปิดระบบตรวจสลิปอัตโนมัติ (EASYSLIP_TOKEN)" };

  try {
    const { body, headers } = buildRequestBody(input);
    const response = await fetchImpl(EASYSLIP_VERIFY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, ...headers },
      body,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    const json = asObject(await response.json().catch(() => null));
    const data = asObject(json?.data);
    if (!response.ok || json?.success !== true || !data) {
      const error = asObject(json?.error);
      return classifyEasySlipFailure(response.ok ? 502 : response.status, asString(error?.code), asString(error?.message));
    }
    return evaluateVerifiedSlip(data, input);
  } catch (error) {
    // ต่อไม่ติด/หมดเวลา = ปัญหาฝั่งเรา ไม่ใช่ของสลิป → ลองใหม่
    const message = providerText(error instanceof Error ? error.message : String(error));
    return { status: "PENDING", note: `ติดต่อผู้ให้บริการตรวจสลิปไม่ได้ (${message}) — ระบบจะตรวจซ้ำให้เอง` };
  }
}
