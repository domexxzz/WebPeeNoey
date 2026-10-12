"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { AdminActionState } from "@/app/(admin)/admin/actions";

type Action = (previous: AdminActionState, formData: FormData) => Promise<AdminActionState>;

const INITIAL_STATE: AdminActionState = { status: "idle" };

const TONES = {
  primary: "bg-emerald-500 hover:bg-emerald-400 text-black",
  danger: "bg-red-500 hover:bg-red-400 text-white",
  neutral: "bg-white/10 hover:bg-white/20 text-white",
} as const;

function SubmitButton({ label, pendingLabel, tone }: { label: string; pendingLabel: string; tone: keyof typeof TONES }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${TONES[tone]}`}
    >
      {pending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
      {pending ? pendingLabel : label}
    </button>
  );
}

interface ActionFormProps {
  action: Action;
  submitLabel: string;
  pendingLabel?: string;
  tone?: keyof typeof TONES;
  children?: React.ReactNode;
  className?: string;
}

/**
 * ฟอร์มสำหรับ server action ของหลังบ้าน — ปุ่มถูกปิดระหว่างส่ง (กันกดซ้ำฝั่ง UI)
 * ส่วนการกันซ้ำจริงอยู่ที่ service (row lock + ตรวจสถานะ)
 */
export function ActionForm({ action, submitLabel, pendingLabel = "กำลังดำเนินการ...", tone = "primary", children, className = "" }: ActionFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  return (
    <form action={formAction} className={`space-y-3 ${className}`}>
      {children}
      <SubmitButton label={submitLabel} pendingLabel={pendingLabel} tone={tone} />
      {state.status === "success" && (
        <p role="status" className="flex items-start gap-2 text-sm text-emerald-300">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="flex items-start gap-2 text-sm text-red-300">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}
    </form>
  );
}
