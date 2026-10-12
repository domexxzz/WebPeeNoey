import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/page-guard";
import { prisma } from "@/lib/prisma";
import { SYSTEM_SETTING_ID } from "@/lib/db/constants";
import { getPaymentAvailability } from "@/lib/orders/availability";
import { ActionForm } from "@/components/admin/action-form";
import { AdminCard, AdminPageHeader, inputClass, labelClass } from "@/components/admin/admin-ui";
import { updateSettingsAction } from "../actions";

export const metadata: Metadata = { title: "ตั้งค่าระบบ", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const AVAILABILITY_TEXT = {
  DISABLED: "ปิดรับชำระเงิน",
  MAINTENANCE: "ปิดปรับปรุงระบบ",
  NOT_CONFIGURED: "เปิดไว้แต่บัญชี PromptPay ไม่ครบ — ระบบจึงยังไม่รับเงิน",
} as const;

export default async function AdminSettingsPage() {
  await requireAdminPage();
  const [setting, availability] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { id: SYSTEM_SETTING_ID } }),
    getPaymentAvailability(prisma),
  ]);

  return (
    <div className="space-y-6 max-w-2xl">
      <AdminPageHeader title="ตั้งค่าระบบ" description="ทุกการเปลี่ยนแปลงบันทึกค่าก่อน/หลังใน Audit Log" />

      <p
        role="status"
        className={`border px-4 py-3 text-sm ${
          availability.open ? "border-signal bg-signal-muted text-gray-100" : "border-amber-500/30 bg-amber-500/10 text-amber-100"
        }`}
      >
        สถานะตอนนี้: {availability.open ? `เปิดรับชำระเงิน → ${availability.accountName} (${availability.target})` : AVAILABILITY_TEXT[availability.reason]}
      </p>

      <AdminCard title="การรับชำระเงิน (PromptPay)">
        <ActionForm action={updateSettingsAction} submitLabel="บันทึกการตั้งค่า" pendingLabel="กำลังบันทึก...">
          <div>
            <label className={labelClass} htmlFor="promptpayNumber">เลข PromptPay (เบอร์มือถือ 10 หลัก / เลขประจำตัว 13 หลัก / e-Wallet 15 หลัก)</label>
            <input id="promptpayNumber" name="promptpayNumber" defaultValue={setting?.promptpayNumber ?? ""} inputMode="numeric" autoComplete="off" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="promptpayAccountName">ชื่อบัญชีผู้รับ (ลูกค้าเห็นคู่กับ QR — ต้องตรงกับที่แอปธนาคารแสดง)</label>
            <input id="promptpayAccountName" name="promptpayAccountName" defaultValue={setting?.promptpayAccountName ?? ""} maxLength={100} className={inputClass} />
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-300">
            <input type="checkbox" name="paymentsEnabled" defaultChecked={setting?.paymentsEnabled ?? false} className="mt-1 accent-[#6EEA6E]" />
            <span>
              เปิดรับชำระเงิน
              <span className="block text-xs text-gray-400">ปิดเมื่อไรก็ได้ — QR ของคำสั่งซื้อที่ค้างจะถูกซ่อนทันที แต่ลูกค้ายังแนบสลิปได้</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-300">
            <input type="checkbox" name="maintenanceMode" defaultChecked={setting?.maintenanceMode ?? false} className="mt-1 accent-[#6EEA6E]" />
            โหมดปิดปรับปรุง (ปิดรับคำสั่งซื้อใหม่)
          </label>
        </ActionForm>
      </AdminCard>
    </div>
  );
}
