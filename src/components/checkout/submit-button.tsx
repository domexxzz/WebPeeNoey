"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

interface SubmitButtonProps {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}

/** ปุ่มส่งฟอร์มที่ปิดตัวเองระหว่างส่ง — กันการกดซ้ำฝั่ง UI (ฝั่ง server กันซ้ำด้วย lock อีกชั้น) */
export function SubmitButton({ children, pendingLabel, className = "" }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-ink bg-signal hover:bg-signal-hover transition-all disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal rounded-xl ${className}`}
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
