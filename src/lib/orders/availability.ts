import type { PrismaClient } from "@prisma/client";
import { SYSTEM_SETTING_ID } from "@/lib/db/constants";
import { normalizePromptPayTarget } from "@/lib/payments/promptpay";

export type PaymentAvailability =
  | { open: true; target: string; accountName: string }
  | { open: false; reason: "DISABLED" | "MAINTENANCE" | "NOT_CONFIGURED" };

/**
 * ตรวจว่ารับชำระเงินได้หรือไม่ (Kill-switch)
 * ต้องเปิด paymentsEnabled, ไม่อยู่ในโหมดปิดปรับปรุง และมีเลข PromptPay + ชื่อบัญชีที่ถูกต้อง
 * — ถ้าแอดมินเปิดรับเงินแต่ยังไม่กรอกบัญชี จะถือว่าปิด เพื่อไม่ให้สร้าง QR ไปบัญชีที่ไม่ถูกต้อง
 */
export async function getPaymentAvailability(db: PrismaClient): Promise<PaymentAvailability> {
  const setting = await db.systemSetting.findUnique({ where: { id: SYSTEM_SETTING_ID } });
  if (!setting?.paymentsEnabled) return { open: false, reason: "DISABLED" };
  if (setting.maintenanceMode) return { open: false, reason: "MAINTENANCE" };

  const target = normalizePromptPayTarget(setting.promptpayNumber);
  const accountName = setting.promptpayAccountName.trim();
  if (!target.ok || !accountName) return { open: false, reason: "NOT_CONFIGURED" };

  return { open: true, target: target.target, accountName };
}
