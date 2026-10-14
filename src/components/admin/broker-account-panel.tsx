import type { Broker, BrokerAccountStatus, TradingPlatform } from "@prisma/client";
import { BROKERS, PLATFORMS } from "@/config/broker-ib";
import { formatDateTime } from "@/lib/format";
import { releaseBrokerAccountAction, revokeBrokerAccessAction } from "@/app/(admin)/admin/broker-ib-actions";
import { ActionForm } from "./action-form";
import { AdminCard, inputClass, labelClass } from "./admin-ui";

interface BrokerAccountView {
  id: string;
  broker: Broker;
  platform: TradingPlatform;
  accountNumber: string;
  registeredEmail: string;
  status: BrokerAccountStatus;
  firstVerifiedAt: Date | null;
  lastVerifiedAt: Date | null;
}

const STATUS_LABEL: Record<BrokerAccountStatus, string> = {
  PENDING: "รอตรวจครั้งแรก",
  VERIFIED: "ยืนยันแล้ว",
  RELEASED: "ปลดการผูกแล้ว",
};

/** บัญชีเทรดที่สมาชิกผูกไว้ + ปิดสิทธิ์ผ่าน IB / ปลดการผูกบัญชี (ทุกการกระทำบันทึก Audit Log) */
export function BrokerAccountPanel({ userId, email, accounts, hasIbAccess }: { userId: string; email: string; accounts: BrokerAccountView[]; hasIbAccess: boolean }) {
  const active = accounts.filter((account) => account.status !== "RELEASED");
  if (accounts.length === 0 && !hasIbAccess) return null;

  return (
    <AdminCard title="บัญชีโบรกเกอร์ (สิทธิ์ผ่าน IB)">
      {accounts.length === 0 ? (
        <p className="text-sm text-fg-subtle">ไม่มีบัญชีเทรดที่ผูกอยู่</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {accounts.map((account) => (
            <li key={account.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-fg-muted">
              <span className="font-mono font-semibold text-fg select-all">{account.accountNumber}</span>
              <span>
                {BROKERS[account.broker].label} · {PLATFORMS[account.platform]}
              </span>
              <span className="select-all">{account.registeredEmail}</span>
              <span className={account.status === "VERIFIED" ? "text-gold-ink" : "text-fg-subtle"}>{STATUS_LABEL[account.status]}</span>
              {account.lastVerifiedAt && <span className="text-xs text-fg-subtle">ตรวจล่าสุด {formatDateTime(account.lastVerifiedAt)}</span>}
            </li>
          ))}
        </ul>
      )}

      {hasIbAccess && (
        <ActionForm action={revokeBrokerAccessAction} submitLabel="ปิดสิทธิ์ผ่าน IB" pendingLabel="กำลังปิดสิทธิ์..." tone="danger" className="border-t border-line pt-4">
          <p className="text-xs text-red-800">ปิดเฉพาะช่วงสิทธิ์ที่ได้จาก IB (เช่น บัญชีออกจาก IB แล้ว / ข้อมูลเท็จ) — ช่วงที่จ่ายเงินซึ่งต่อคิวอยู่จะเลื่อนมาเริ่มทันที</p>
          <input type="hidden" name="userId" value={userId} />
          <div>
            <label className={labelClass} htmlFor="ibRevokeReason">เหตุผล (บันทึกใน Audit Log)</label>
            <input id="ibRevokeReason" name="reason" required minLength={2} maxLength={300} className={inputClass} />
          </div>
          <label className="flex items-start gap-2 text-sm text-fg-muted">
            <input type="checkbox" name="releaseAccount" className="mt-1 accent-red-500" />
            ปลดการผูกบัญชีเทรดด้วย
          </label>
          <label className="flex items-start gap-2 text-sm text-fg-muted">
            <input type="checkbox" name="confirmRevoke" required className="mt-1 accent-red-500" />
            ยืนยันการปิดสิทธิ์ผ่าน IB ของ {email}
          </label>
        </ActionForm>
      )}

      {active.map((account) => (
        <ActionForm
          key={account.id}
          action={releaseBrokerAccountAction}
          submitLabel={`ปลดการผูกบัญชี ${account.accountNumber}`}
          pendingLabel="กำลังปลด..."
          tone="neutral"
          className="border-t border-line pt-4"
        >
          <p className="text-xs text-fg-subtle">ใช้เมื่อเจ้าของบัญชีจริงแสดงหลักฐานว่ามีคนยื่นดักไว้ หรือสมาชิกขอเปลี่ยนบัญชี — ไม่กระทบสิทธิ์ที่อนุมัติไปแล้ว</p>
          <input type="hidden" name="brokerAccountId" value={account.id} />
          <div>
            <label className={labelClass} htmlFor={`release-${account.id}`}>เหตุผล</label>
            <input id={`release-${account.id}`} name="reason" required minLength={2} maxLength={300} className={inputClass} />
          </div>
          <label className="flex items-start gap-2 text-sm text-fg-muted">
            <input type="checkbox" name="confirmRelease" required className="mt-1 accent-[#B8860B]" />
            ยืนยันการปลดการผูกบัญชี {account.accountNumber}
          </label>
        </ActionForm>
      ))}
    </AdminCard>
  );
}
