import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/page-guard";
import { prisma } from "@/lib/prisma";
import { SYSTEM_SETTING_ID } from "@/lib/db/constants";
import { getPaymentAvailability } from "@/lib/orders/availability";
import { ActionForm } from "@/components/admin/action-form";
import { AdminCard, AdminPageHeader, inputClass, labelClass } from "@/components/admin/admin-ui";
import { updateSettingsAction } from "../actions";
import { updateBrokerIbSettingsAction } from "../broker-ib-actions";
import { computeBrokerIbAvailability, type BrokerIbAvailability } from "@/lib/broker-ib/availability";
import { LOCKED_LINK_ENV_KEY, readLockedLinks } from "@/lib/broker-ib/link-lock";
import { Lock } from "lucide-react";

export const metadata: Metadata = { title: "ตั้งค่าระบบ", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const AVAILABILITY_TEXT = {
  DISABLED: "ปิดรับชำระเงิน",
  MAINTENANCE: "ปิดปรับปรุงระบบ",
  NOT_CONFIGURED: "เปิดไว้แต่บัญชี PromptPay ไม่ครบ — ระบบจึงยังไม่รับเงิน",
} as const;

const IB_STATUS_TEXT = {
  DISABLED: "ปิดรับคำขอ — ไม่แสดงบนหน้าเว็บ",
  MAINTENANCE: "ปิดปรับปรุงระบบ — ไม่แสดงบนหน้าเว็บ",
  NOT_CONFIGURED: "เปิดไว้แต่ข้อมูลไม่ครบ — ยังไม่แสดงบนหน้าเว็บ",
} as const;

function ibStatusText(availability: BrokerIbAvailability): string {
  if (!availability.open) return IB_STATUS_TEXT[availability.reason];
  return `เปิดรับคำขอ — ${availability.brokers.map((offer) => offer.label).join(", ")} · ฝากขั้นต่ำ $${availability.minDepositUsd}`;
}

export default async function AdminSettingsPage() {
  await requireAdminPage();
  const [setting, availability, pendingClaims] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { id: SYSTEM_SETTING_ID } }),
    getPaymentAvailability(prisma),
    prisma.order.count({ where: { kind: "BROKER_IB", status: "CLAIM_SUBMITTED" } }),
  ]);
  const ibMinDeposit = setting?.ibMinDepositUsd?.toNumber() ?? null;
  const lockedLinks = readLockedLinks();
  const ibAvailability = computeBrokerIbAvailability(
    setting
      ? {
          ibClaimsEnabled: setting.ibClaimsEnabled,
          maintenanceMode: setting.maintenanceMode,
          ibXmLink: lockedLinks.XM ?? setting.ibXmLink,
          ibExnessLink: lockedLinks.EXNESS ?? setting.ibExnessLink,
          ibMinDepositUsd: ibMinDeposit,
        }
      : null,
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <AdminPageHeader title="ตั้งค่าระบบ" description="ทุกการเปลี่ยนแปลงบันทึกค่าก่อน/หลังใน Audit Log" />

      <p
        role="status"
        className={`border px-4 py-3 text-sm rounded-xl ${
          availability.open ? "border-gold bg-gold-muted text-fg" : "border-orange-500/30 bg-orange-500/10 text-orange-900"
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
          <label className="flex items-start gap-2 text-sm text-fg-muted">
            <input type="checkbox" name="paymentsEnabled" defaultChecked={setting?.paymentsEnabled ?? false} className="mt-1 accent-[#B8860B]" />
            <span>
              เปิดรับชำระเงิน
              <span className="block text-xs text-fg-subtle">ปิดเมื่อไรก็ได้ — QR ของคำสั่งซื้อที่ค้างจะถูกซ่อนทันที แต่ลูกค้ายังแนบสลิปได้</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-fg-muted">
            <input type="checkbox" name="maintenanceMode" defaultChecked={setting?.maintenanceMode ?? false} className="mt-1 accent-[#B8860B]" />
            โหมดปิดปรับปรุง (ปิดรับคำสั่งซื้อใหม่)
          </label>
        </ActionForm>
      </AdminCard>

      <AdminCard title="สิทธิ์ฟรีผ่านโบรกเกอร์ (IB)">
        <p role="status" className={`mb-4 border px-4 py-3 text-sm rounded-xl ${ibAvailability.open ? "border-gold bg-gold-muted text-fg" : "border-line bg-surface-sunken text-fg-muted"}`}>
          สถานะ: {ibStatusText(ibAvailability)}
          {pendingClaims > 0 && <span className="block text-xs">มีคำขอรอตรวจ {pendingClaims} รายการ — ยังตรวจได้แม้ปิดรับคำขอใหม่</span>}
        </p>
        <ActionForm action={updateBrokerIbSettingsAction} submitLabel="บันทึกการตั้งค่า IB" pendingLabel="กำลังบันทึก...">
          {(["XM", "EXNESS"] as const).map((broker) => {
            const name = broker === "XM" ? "ibXmLink" : "ibExnessLink";
            const lockedLink = lockedLinks[broker];
            return (
              <div key={broker}>
                <label className={labelClass} htmlFor={name}>
                  ลิงก์พาร์ทเนอร์ {broker === "XM" ? "XM" : "Exness"} (https://...)
                </label>
                <input
                  id={name}
                  name={name}
                  type="url"
                  defaultValue={lockedLink ?? (setting?.[name] ?? "")}
                  readOnly={Boolean(lockedLink)}
                  aria-describedby={lockedLink ? `${name}-locked` : undefined}
                  maxLength={500}
                  autoComplete="off"
                  className={`${inputClass} ${lockedLink ? "cursor-not-allowed bg-surface-sunken text-fg-muted" : ""}`}
                />
                {lockedLink && (
                  <p id={`${name}-locked`} className="mt-1 flex items-center gap-1 text-xs text-fg-subtle">
                    <Lock className="w-3 h-3" aria-hidden="true" /> ล็อกด้วยค่าบนเซิร์ฟเวอร์ ({LOCKED_LINK_ENV_KEY[broker]}) — เปลี่ยนได้ที่ Render เท่านั้น
                  </p>
                )}
              </div>
            );
          })}
          <div>
            <label className={labelClass} htmlFor="ibMinDepositUsd">ยอดฝากครั้งแรกขั้นต่ำ (USD)</label>
            <input id="ibMinDepositUsd" name="ibMinDepositUsd" inputMode="decimal" defaultValue={ibMinDeposit ?? ""} autoComplete="off" className={inputClass} />
          </div>
          <label className="flex items-start gap-2 text-sm text-fg-muted">
            <input type="checkbox" name="ibClaimsEnabled" defaultChecked={setting?.ibClaimsEnabled ?? false} className="mt-1 accent-[#B8860B]" />
            <span>
              เปิดรับคำขอสิทธิ์ผ่าน IB
              <span className="block text-xs text-fg-subtle">
                เปิดแล้วหน้าเว็บจะแสดงลิงก์และขั้นตอน — ก่อนเปิดควรตรวจข้อกฎหมายเรื่องการแนะนำโบรกเกอร์ต่างประเทศให้ลูกค้าในไทย
              </span>
            </span>
          </label>
        </ActionForm>
      </AdminCard>
    </div>
  );
}
