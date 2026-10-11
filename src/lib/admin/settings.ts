import type { PrismaClient } from "@prisma/client";
import { SYSTEM_SETTING_ID } from "@/lib/db/constants";
import { normalizePromptPayTarget } from "@/lib/payments/promptpay";
import type { ActorContext } from "./guard";
import { writeAudit } from "./audit";

const ACCOUNT_NAME_MAX = 100;

export type SettingsResult = { ok: true } | { ok: false; code: "INVALID_PROMPTPAY" | "ACCOUNT_NAME_REQUIRED" };

interface PaymentSettingsInput {
  actor: ActorContext;
  paymentsEnabled: boolean;
  maintenanceMode: boolean;
  promptpayNumber: string;
  promptpayAccountName: string;
}

/**
 * แก้ไขการตั้งค่ารับชำระเงิน (Kill-switch + บัญชี PromptPay)
 * ไม่ยอมเปิดรับเงินถ้าเลข PromptPay หรือชื่อบัญชีไม่ถูกต้อง และบันทึกค่าก่อน/หลังใน AuditLog
 */
export async function updatePaymentSettings(db: PrismaClient, input: PaymentSettingsInput): Promise<SettingsResult> {
  const rawNumber = input.promptpayNumber.trim();
  const target = rawNumber ? normalizePromptPayTarget(rawNumber) : null;
  if (target && !target.ok) return { ok: false, code: "INVALID_PROMPTPAY" };
  if (input.paymentsEnabled && !target) return { ok: false, code: "INVALID_PROMPTPAY" };

  const accountName = input.promptpayAccountName.trim().replace(/\s+/g, " ").slice(0, ACCOUNT_NAME_MAX);
  if (input.paymentsEnabled && !accountName) return { ok: false, code: "ACCOUNT_NAME_REQUIRED" };

  const after = {
    paymentsEnabled: input.paymentsEnabled,
    maintenanceMode: input.maintenanceMode,
    promptpayNumber: target?.ok ? target.target : "",
    promptpayAccountName: accountName,
  };

  await db.$transaction(async (tx) => {
    // ล็อกแถวตั้งค่าก่อนอ่าน เพื่อให้ค่า "ก่อน" ใน AuditLog ถูกต้องแม้แอดมินสองคนบันทึกพร้อมกัน
    await tx.$queryRaw`SELECT id FROM "SystemSetting" WHERE id = ${SYSTEM_SETTING_ID} FOR UPDATE`;
    const current = await tx.systemSetting.findUnique({ where: { id: SYSTEM_SETTING_ID } });
    await tx.systemSetting.upsert({ where: { id: SYSTEM_SETTING_ID }, create: { id: SYSTEM_SETTING_ID, ...after }, update: after });
    await writeAudit(tx, {
      actor: input.actor,
      action: "SETTINGS_UPDATE",
      targetType: "System",
      targetId: SYSTEM_SETTING_ID,
      details: {
        before: current
          ? {
              paymentsEnabled: current.paymentsEnabled,
              maintenanceMode: current.maintenanceMode,
              promptpayNumber: current.promptpayNumber,
              promptpayAccountName: current.promptpayAccountName,
            }
          : null,
        after,
      },
    });
  });
  return { ok: true };
}
