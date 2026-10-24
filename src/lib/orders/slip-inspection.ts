import { getSlipCheckConfig } from "@/config/slip-check";
import { checkSlipWithEasySlip, type SlipCheckInput, type SlipCheckResult } from "@/lib/payments/easyslip";
import { readSlipQr, type SlipQrResult } from "@/lib/payments/slip-qr";

/** ตัวอ่าน QR + ตัวตรวจกับธนาคาร — ส่งเข้ามาเป็น dependency ให้เทสต์ใส่ตัวปลอมได้โดยไม่ต้องยิง API จริง */
export interface SlipInspector {
  readQr: (bytes: Uint8Array) => Promise<SlipQrResult>;
  check: (input: SlipCheckInput) => Promise<SlipCheckResult>;
  /** SLIP_RECEIVER_ACCOUNTS — เทียบเพิ่มจากเลขพร้อมเพย์ของออเดอร์ */
  receiverAccounts: string[];
}

export const SLIP_CHECK_DISABLED: SlipCheckResult = { status: "DISABLED", note: "ไม่ได้ตรวจกับธนาคาร" };

export function createSlipInspector(): SlipInspector {
  const config = getSlipCheckConfig();
  return {
    readQr: readSlipQr,
    check: (input) => checkSlipWithEasySlip(input, { token: config.easyslipToken }),
    receiverAccounts: config.receiverAccounts,
  };
}

const PROVIDER_ALERT_INTERVAL_MS = 60 * 60 * 1000;
let lastProviderAlertAt = 0;

/**
 * แจ้งกลุ่มแอดมินเรื่อง token/โควตา EasySlip ไม่เกินชั่วโมงละครั้งต่อโปรเซส
 * (สลิปทุกใบเจอปัญหาเดียวกัน — ไม่จำกัดจะถล่มกลุ่มแอดมินทุกครั้งที่ลูกค้าแนบสลิป; ป้ายในหน้าแอดมินยังโชว์ทุกใบ)
 */
export function shouldAlertProviderProblem(now: Date): boolean {
  if (now.getTime() - lastProviderAlertAt < PROVIDER_ALERT_INTERVAL_MS) return false;
  lastProviderAlertAt = now.getTime();
  return true;
}

/** ใช้ในเทสต์เท่านั้น */
export function resetProviderAlertThrottle(): void {
  lastProviderAlertAt = 0;
}

/** ฟิลด์ผลตรวจที่บันทึกลง SlipUpload (ใช้ทั้งตอนรับสลิปและตอนตรวจซ้ำ) */
export function slipCheckFields(check: SlipCheckResult, now: Date) {
  return {
    checkStatus: check.status,
    checkNote: check.note,
    checkedAt: check.status === "DISABLED" ? null : now,
    transRef: check.transRef ?? null,
    slipAmount: check.amount ?? null,
    slipDate: check.slipDate ?? null,
    receiverName: check.receiverName ?? null,
  };
}
