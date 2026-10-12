import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { AlertTriangle, CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatTHB } from "@/config/plans";
import { PAYMENT_RULES } from "@/config/payment";
import { getPaymentAvailability, quoteForUser } from "@/lib/orders/checkout";
import { checkoutErrorMessage, PRICE_REASON_LABELS } from "@/lib/orders/messages";
import { SubmitButton } from "@/components/checkout/submit-button";
import { createOrderAction } from "../actions";

export const metadata: Metadata = { title: "ยืนยันคำสั่งซื้อ", robots: { index: false, follow: false } };

interface PageProps {
  params: Promise<{ plan: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function CheckoutPlanPage({ params, searchParams }: PageProps) {
  const [{ plan: planSlug }, query] = await Promise.all([params, searchParams]);
  const session = await getServerSession(authOptions);
  const checkout = session?.user ? await quoteForUser(prisma, { userId: session.user.id, planSlug }) : null;
  if (!checkout) notFound();

  const availability = await getPaymentAvailability(prisma);
  const error = checkoutErrorMessage(query.error);
  const { plan, quote } = checkout;
  const showStrikePrice = quote.reason !== "REGULAR" && plan.originalPrice !== null && plan.originalPrice > quote.basePrice;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <p className="text-sm font-semibold text-amber-400">ขั้นตอนที่ 1 จาก 2</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-white">ยืนยันคำสั่งซื้อ</h1>
        <p className="mt-2 text-sm text-gray-400">ตรวจสอบแพ็กเกจและราคา จากนั้นระบบจะสร้าง PromptPay QR พร้อมยอดเงินให้ทันที</p>
      </header>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="plan-heading" className="rounded-2xl glass-panel p-6">
          <h2 id="plan-heading" className="font-heading text-xl font-bold text-white">{plan.name}</h2>
          <p className="mt-1 text-sm text-gray-400">อายุการใช้งาน {plan.durationDays} วัน — ต่ออายุแบบทบวันจากวันหมดอายุเดิม</p>
          <ul className="mt-5 space-y-2.5">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-gray-300">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="price-heading" className="rounded-2xl glass-panel-gold p-6 flex flex-col">
          <h2 id="price-heading" className="text-sm font-medium text-amber-300">{PRICE_REASON_LABELS[quote.reason]}</h2>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-heading text-4xl font-bold text-white">{formatTHB(quote.basePrice)}</span>
            {showStrikePrice && <span className="text-sm text-gray-400 line-through">{formatTHB(plan.originalPrice!)}</span>}
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-gray-300 leading-relaxed">
            <Info className="w-4 h-4 shrink-0 text-amber-400" aria-hidden="true" />
            ยอดโอนจริงจะหักเศษสตางค์ออกเล็กน้อย (ไม่เกิน 0.99 บาท) เพื่อใช้ยืนยันว่าเป็นคำสั่งซื้อของคุณ
          </p>

          {availability.open ? (
            <form action={createOrderAction} className="mt-6 space-y-4">
              <input type="hidden" name="planSlug" value={plan.slug} />
              {/* ราคาที่ผู้ใช้เห็น — ถ้าเปลี่ยนก่อนกดยืนยัน ระบบจะไม่สร้างออเดอร์ (PRICE_CHANGED) */}
              <input type="hidden" name="expectedBasePrice" value={quote.basePrice} />
              <label className="flex items-start gap-3 text-sm text-gray-300">
                <input type="checkbox" name="acceptTerms" required className="mt-1 h-4 w-4 accent-amber-500" />
                <span>
                  ฉันได้อ่านและยอมรับ{" "}
                  <Link href="/terms" target="_blank" className="text-amber-400 underline underline-offset-2">ข้อกำหนดการใช้บริการ</Link> และ{" "}
                  <Link href="/refund" target="_blank" className="text-amber-400 underline underline-offset-2">นโยบายการคืนเงิน</Link>
                </span>
              </label>
              <SubmitButton pendingLabel="กำลังสร้างคำสั่งซื้อ..." className="w-full">
                ยืนยันและรับ QR ชำระเงิน
              </SubmitButton>
              <p className="flex items-center gap-1.5 text-xs text-gray-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                ชำระภายใน {PAYMENT_RULES.paymentWindowMinutes} นาทีหลังสร้างคำสั่งซื้อ ไม่มีการตัดเงินอัตโนมัติ
              </p>
            </form>
          ) : (
            <p role="status" className="mt-6 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" aria-hidden="true" />
              ขณะนี้ระบบปิดรับชำระเงินชั่วคราว กรุณากลับมาใหม่ภายหลัง หรือติดต่อทีมงาน
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
