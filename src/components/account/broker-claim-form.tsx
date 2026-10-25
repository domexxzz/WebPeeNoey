"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import type { Broker } from "@prisma/client";
import { submitBrokerClaimAction, type BrokerClaimFormState } from "@/app/(account)/account/broker-ib/actions";
import { SubmitButton } from "@/components/checkout/submit-button";

const initialState: BrokerClaimFormState = { status: "idle" };

const inputClass =
  "mt-1.5 w-full border border-line bg-surface px-3.5 py-2.5 text-sm text-fg rounded-xl focus:border-gold focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-ink";
const labelClass = "block text-sm font-medium text-fg";
const checkClass = "flex items-start gap-2.5 text-sm text-fg-muted";
const boxClass = "mt-0.5 h-4 w-4 shrink-0 accent-[#B8860B]";

interface NewClaimProps {
  mode: "NEW";
  brokers: { broker: Broker; label: string; minDepositThb: number }[];
  defaultEmail: string;
  noPasswordNote: string;
}

interface RenewProps {
  mode: "RENEW";
  accountLabel: string;
  noPasswordNote: string;
}

function FormResult({ state }: { state: BrokerClaimFormState }) {
  if (state.status === "success") {
    return (
      <p role="status" className="flex items-start gap-2 text-sm text-gold-ink">
        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
        {state.message}
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="flex items-start gap-2 text-sm text-red-700">
        <XCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
        {state.message}
      </p>
    );
  }
  return null;
}

function TermsCheckbox() {
  return (
    <label className={checkClass}>
      <input type="checkbox" name="acceptTerms" required className={boxClass} />
      <span>
        ยอมรับ{" "}
        <Link href="/terms" target="_blank" className="underline underline-offset-4 hover:text-gold-ink">
          ข้อกำหนดการใช้บริการ
        </Link>{" "}
        (รวมเงื่อนไขสิทธิ์ผ่านโบรกเกอร์)
      </span>
    </label>
  );
}

/** ฟอร์มยื่นคำขอสิทธิ์ผ่าน IB — ครั้งแรก (กรอกบัญชี) หรือต่ออายุ (ใช้บัญชีที่ยืนยันแล้ว) */
export function BrokerClaimForm(props: NewClaimProps | RenewProps) {
  const [state, formAction] = useActionState(submitBrokerClaimAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="mode" value={props.mode} />
      {props.mode === "NEW" ? (
        <>
          <fieldset>
            <legend className={labelClass}>โบรกเกอร์ที่เปิดบัญชีผ่านลิงก์ของเรา</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {props.brokers.map((offer, index) => (
                <label key={offer.broker} className="inline-flex items-center gap-2 border border-line px-4 py-2 text-sm text-fg rounded-xl has-[:checked]:border-gold has-[:checked]:bg-gold-muted">
                  <input type="radio" name="broker" value={offer.broker} defaultChecked={index === 0} required className="accent-[#B8860B]" />
                  {offer.label} <span className="text-fg-muted">— ขั้นต่ำ {offer.minDepositThb.toLocaleString("th-TH")} บาท</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="platform">แพลตฟอร์ม</label>
              <select id="platform" name="platform" defaultValue="MT5" className={inputClass}>
                <option value="MT5">MetaTrader 5 (MT5)</option>
                <option value="MT4">MetaTrader 4 (MT4)</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="accountNumber">เลขบัญชีเทรด (Login)</label>
              <input id="accountNumber" name="accountNumber" inputMode="numeric" autoComplete="off" required maxLength={20} placeholder="เช่น 12345678" className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="registeredEmail">อีเมลที่ใช้สมัครกับโบรกเกอร์</label>
            <input id="registeredEmail" name="registeredEmail" type="email" defaultValue={props.defaultEmail} required maxLength={254} className={inputClass} />
          </div>
          <label className={checkClass}>
            <input type="checkbox" name="confirmOpenedViaLink" required className={boxClass} />
            ฉันเปิดบัญชีนี้ผ่านลิงก์พาร์ทเนอร์ของเว็บไซต์นี้
          </label>
          <label className={checkClass}>
            <input type="checkbox" name="confirmDeposit" required className={boxClass} />
            ฉันฝากเงินครั้งแรกในบัญชีนี้แล้วไม่น้อยกว่ายอดขั้นต่ำของโบรกเกอร์ที่เลือกด้านบน
          </label>
        </>
      ) : (
        <>
          <p className="text-sm text-fg-muted">
            ต่อสิทธิ์ด้วยบัญชี <span className="font-mono font-semibold text-fg">{props.accountLabel}</span> — ทีมงานจะตรวจบัญชีใน Partner Portal อีกครั้ง
          </p>
          <label className={checkClass}>
            <input type="checkbox" name="confirmStillActive" required className={boxClass} />
            บัญชีนี้ยังอยู่ภายใต้ลิงก์พาร์ทเนอร์ของเราและยังใช้งานตามเงื่อนไข
          </label>
        </>
      )}
      <TermsCheckbox />
      <p className="flex items-start gap-2 text-xs text-fg-subtle">
        <ShieldCheck className="w-4 h-4 shrink-0 text-gold-ink" aria-hidden="true" />
        {props.noPasswordNote}
      </p>
      <SubmitButton pendingLabel="กำลังส่งคำขอ...">{props.mode === "NEW" ? "ส่งคำขอให้ทีมงานตรวจสอบ" : "ขอต่อสิทธิ์อีก 30 วัน"}</SubmitButton>
      <FormResult state={state} />
    </form>
  );
}
