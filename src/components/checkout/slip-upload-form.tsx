"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, ImageUp, XCircle } from "lucide-react";
import { PAYMENT_RULES } from "@/config/payment";
import { submitSlipAction, type SlipFormState } from "@/app/(account)/checkout/actions";
import { SubmitButton } from "./submit-button";

const INITIAL_STATE: SlipFormState = { status: "idle" };
const MAX_BYTES = PAYMENT_RULES.slipMaxSizeMb * 1024 * 1024;

export function SlipUploadForm({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState(submitSlipAction, INITIAL_STATE);
  const [clientError, setClientError] = useState<string | null>(null);

  // ตรวจขนาดก่อนส่ง เพื่อไม่ต้องอัปโหลดไฟล์ใหญ่ทิ้ง (server ตรวจซ้ำอีกครั้งเสมอ)
  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setClientError(file && file.size > MAX_BYTES ? `ไฟล์ใหญ่เกิน ${PAYMENT_RULES.slipMaxSizeMb}MB` : null);
  };

  if (state.status === "success") {
    return (
      <p role="status" className="flex items-start gap-2 border border-gold bg-gold-muted px-4 py-3 text-sm text-fg rounded-xl">
        <CheckCircle2 className="w-5 h-5 shrink-0 text-gold-ink" aria-hidden="true" />
        {state.message}
      </p>
    );
  }

  const error = clientError ?? (state.status === "error" ? state.message : null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="block">
        <span className="flex items-center gap-2 text-sm font-medium text-fg">
          <ImageUp className="w-4 h-4 text-gold-ink" aria-hidden="true" />
          แนบสลิปการโอน
        </span>
        <span className="mt-1 block text-xs text-fg-subtle">
          ไฟล์ {PAYMENT_RULES.slipAllowedFormats.join(", ")} ขนาดไม่เกิน {PAYMENT_RULES.slipMaxSizeMb}MB — สลิป 1 ใบใช้ได้กับคำสั่งซื้อเดียว
        </span>
        <input
          type="file"
          name="slip"
          required
          accept="image/jpeg,image/png,image/webp"
          onChange={onFileChange}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "slip-error" : undefined}
          className="mt-3 block w-full text-sm text-fg-muted file:mr-4 file: file:border-0 file:bg-fg/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-fg hover:file:bg-fg/15"
        />
      </label>

      {error && (
        <p id="slip-error" role="alert" className="flex items-start gap-2 text-sm text-red-700">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <SubmitButton pendingLabel="กำลังส่งสลิป..." className="w-full sm:w-auto">
        ส่งสลิปให้ทีมงานตรวจสอบ
      </SubmitButton>
    </form>
  );
}
