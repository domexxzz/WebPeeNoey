"use client";

import { useActionState } from "react";
import { BellRing, CheckCircle2, ExternalLink } from "lucide-react";
import { createTelegramLinkAction, unlinkTelegramAction, type TelegramLinkState } from "@/app/(account)/account/telegram-actions";
import { SubmitButton } from "@/components/checkout/submit-button";
import { PAYMENT_RULES } from "@/config/payment";

interface TelegramConnectProps {
  enabled: boolean;
  linked: boolean;
  linkedAtLabel: string | null;
}

const initialState: TelegramLinkState = { status: "idle" };

/**
 * เชื่อมบัญชีกับบอท Telegram เพื่อรับแจ้งเตือนก่อนสิทธิ์หมดอายุ
 * คำบนการ์ดต้องบอกให้ชัดว่าเป็นแชตส่วนตัวกับบอท ไม่ใช่ห้องชุมชน — เคยมีคนเข้าใจผิดว่ากดแล้วจะได้เข้ากลุ่ม
 */
export function TelegramConnect({ enabled, linked, linkedAtLabel }: TelegramConnectProps) {
  const [state, formAction] = useActionState(createTelegramLinkAction, initialState);

  return (
    <div className="border border-line bg-surface p-6 border border-line space-y-3 rounded-2xl">
      <h2 className="text-base font-semibold text-fg flex items-center gap-2">
        <BellRing className="w-4 h-4 text-gold-ink" aria-hidden="true" />
        เตือนก่อนหมดอายุทาง Telegram
      </h2>

      {!enabled ? (
        <p className="text-xs text-fg-subtle">การเตือนทาง Telegram ยังไม่เปิดใช้งาน — ระบบจะเตือนทางอีเมลแทน</p>
      ) : linked ? (
        <div className="space-y-3">
          <p className="text-xs text-gold-ink flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            ผูกบัญชีกับบอทแล้ว{linkedAtLabel ? ` (ตั้งแต่ ${linkedAtLabel})` : ""} — บอทจะทักในแชตส่วนตัวก่อนสิทธิ์หมดอายุ
          </p>
          <form action={unlinkTelegramAction}>
            <button type="submit" className="text-xs text-fg-subtle underline underline-offset-2 hover:text-fg">
              ยกเลิกการเชื่อมต่อ
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs text-fg-subtle">
              ผูกบัญชีกับบอทของเรา แล้วบอทจะทักคุณใน <span className="font-medium text-fg">แชตส่วนตัว</span> ก่อนสิทธิ์หมดอายุ{" "}
              {PAYMENT_RULES.expiryReminderDays} วัน (นอกเหนือจากอีเมล) มีแค่คุณกับบอทในแชตนั้น ไม่มีสมาชิกคนอื่นเห็น
            </p>
            <p className="text-[11px] text-fg-subtle">นี่ไม่ใช่การเข้ากลุ่ม — ห้อง Discord VIP และกลุ่ม Telegram VIP อยู่ในรายการช่องทางของแพ็กเกจ</p>
          </div>
          {state.status === "ready" ? (
            <div className="space-y-2">
              <a
                href={state.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-fg bg-gold hover:bg-gold-hover rounded-xl"
              >
                เปิด Telegram แล้วกด Start <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
              <p className="text-[11px] text-fg-subtle">ลิงก์ใช้ได้ครั้งเดียวภายใน 15 นาที — กด Start ในแชตบอทแล้วรีเฟรชหน้านี้</p>
            </div>
          ) : (
            <form action={formAction}>
              <SubmitButton pendingLabel="กำลังสร้างลิงก์..." className="!px-4 !py-2.5 !text-xs">
                เชื่อมต่อ Telegram
              </SubmitButton>
            </form>
          )}
          {state.status === "error" && (
            <p role="alert" className="text-xs text-red-600">
              {state.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
