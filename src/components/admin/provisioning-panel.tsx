import { CheckCircle2, Circle } from "lucide-react";
import { PROVISIONING_CHANNELS, type ProvisioningChannel } from "@/lib/admin/members";
import { setProvisioningAction } from "@/app/(admin)/admin/actions";
import { ActionForm } from "./action-form";

interface ProvisioningPanelProps {
  subscription: { id: string; tradingViewGranted: boolean; discordRoleGranted: boolean; telegramGranted: boolean };
}

/** เช็กลิสต์เปิดสิทธิ์ทีละช่องทาง (ทำด้วยมือ) — ทุกการเปลี่ยนแปลงบันทึก AuditLog */
export function ProvisioningPanel({ subscription }: ProvisioningPanelProps) {
  return (
    <ul className="grid gap-2 sm:grid-cols-3">
      {(Object.keys(PROVISIONING_CHANNELS) as ProvisioningChannel[]).map((channel) => {
        const { field, label } = PROVISIONING_CHANNELS[channel];
        const granted = subscription[field];
        return (
          <li key={channel} className="bg-surface p-3">
            <p className={`flex items-center gap-1.5 text-sm ${granted ? "text-gold-ink" : "text-fg-muted"}`}>
              {granted ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <Circle className="w-4 h-4" aria-hidden="true" />}
              {label}: {granted ? "เปิดแล้ว" : "ยังไม่เปิด"}
            </p>
            <ActionForm action={setProvisioningAction} submitLabel={granted ? "ทำเครื่องหมายว่าปิด" : "ทำเครื่องหมายว่าเปิดแล้ว"} tone="neutral" className="mt-2">
              <input type="hidden" name="subscriptionId" value={subscription.id} />
              <input type="hidden" name="channel" value={channel} />
              <input type="hidden" name="granted" value={granted ? "false" : "true"} />
            </ActionForm>
          </li>
        );
      })}
    </ul>
  );
}
