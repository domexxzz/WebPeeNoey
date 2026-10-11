import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Hourglass, XCircle } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrderForUser, type OrderView } from "@/lib/orders/checkout";
import { Countdown } from "@/components/checkout/countdown";
import { OrderStatusBadge } from "@/components/checkout/order-status-badge";
import { PromptPayQr } from "@/components/checkout/promptpay-qr";
import { SlipUploadForm } from "@/components/checkout/slip-upload-form";

export const metadata: Metadata = { title: "ชำระเงิน", robots: { index: false, follow: false } };
// สถานะออเดอร์เปลี่ยนตามเวลา ต้องคำนวณใหม่ทุกครั้งที่เปิด
export const dynamic = "force-dynamic";

const formatBaht = (amount: number) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(date);

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl glass-panel p-6 space-y-4">{children}</section>;
}

function PaymentPanel({ order, serverNow }: { order: OrderView; serverNow: string }) {
  if (order.paymentSuspended) {
    return (
      <Panel>
        <p role="alert" className="flex items-start gap-2 text-sm text-amber-100">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" aria-hidden="true" />
          ระบบระงับการรับชำระเงินชั่วคราว กรุณาอย่าโอนเงินตาม QR เดิม หากโอนไปแล้ว แนบสลิปด้านล่างหรือติดต่อทีมงาน
        </p>
      </Panel>
    );
  }
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="font-heading text-lg font-semibold text-white">สแกนจ่ายด้วยแอปธนาคาร</h2>
        <p className="flex items-center gap-1.5 whitespace-nowrap text-sm text-amber-300">
          <Clock className="w-4 h-4" aria-hidden="true" />
          เหลือเวลา <Countdown deadline={order.expiresAt.toISOString()} serverNow={serverNow} />
        </p>
      </div>
      {order.promptpayPayload && <PromptPayQr payload={order.promptpayPayload} label={`PromptPay QR ยอด ${formatBaht(order.amount)} บาท`} />}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-black/20 p-3">
          <dt className="text-xs text-gray-400">ยอดที่ต้องโอน</dt>
          <dd className="mt-1 font-heading text-2xl font-bold text-amber-300">{formatBaht(order.amount)} ฿</dd>
        </div>
        <div className="rounded-xl bg-black/20 p-3">
          <dt className="text-xs text-gray-400">ชื่อบัญชีผู้รับ</dt>
          <dd className="mt-1 font-medium text-white break-words">{order.promptpayAccountName || "—"}</dd>
        </div>
      </dl>
      <p className="text-xs text-gray-400 leading-relaxed">
        โปรดโอนตามยอดที่แสดงทุกหลัก (รวมเศษสตางค์) และตรวจชื่อบัญชีผู้รับในแอปธนาคารก่อนยืนยันการโอน
      </p>
    </Panel>
  );
}

function StatusPanel({ order, serverNow }: { order: OrderView; serverNow: string }) {
  switch (order.phase) {
    case "SLIP_GRACE":
      return (
        <Panel>
          <p className="flex items-start gap-2 text-sm text-amber-100">
            <Hourglass className="w-5 h-5 shrink-0 text-amber-400" aria-hidden="true" />
            หมดเวลาชำระเงินแล้ว หากคุณโอนเงินไปแล้ว แนบสลิปได้ภายใน {formatDateTime(order.slipDeadline)} (เหลือ <Countdown deadline={order.slipDeadline.toISOString()} serverNow={serverNow} />)
          </p>
        </Panel>
      );
    case "SLIP_SUBMITTED":
      return (
        <Panel>
          <p className="flex items-start gap-2 text-sm text-blue-100">
            <Clock className="w-5 h-5 shrink-0 text-blue-300" aria-hidden="true" />
            ได้รับสลิปเมื่อ {order.slipUploadedAt ? formatDateTime(order.slipUploadedAt) : "-"} ทีมงานกำลังตรวจสอบ และจะแจ้งผลทางอีเมล
          </p>
        </Panel>
      );
    case "REJECTED":
      return (
        <Panel>
          <p className="flex items-start gap-2 text-sm text-red-200">
            <XCircle className="w-5 h-5 shrink-0 text-red-400" aria-hidden="true" />
            สลิปไม่ผ่านการตรวจสอบ{order.rejectionReason ? `: ${order.rejectionReason}` : ""} — แนบสลิปใบใหม่ได้ด้านล่าง
          </p>
        </Panel>
      );
    case "APPROVED":
      return (
        <Panel>
          <p className="flex items-start gap-2 text-sm text-emerald-200">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" aria-hidden="true" />
            คำสั่งซื้อได้รับอนุมัติแล้ว ดูสิทธิ์การใช้งานได้ที่แดชบอร์ดสมาชิก
          </p>
          <Link href="/account" className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300">
            ไปแดชบอร์ดสมาชิก <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </Panel>
      );
    case "EXPIRED":
      return (
        <Panel>
          <p className="text-sm text-gray-300">คำสั่งซื้อนี้หมดอายุแล้ว หากโอนเงินไปแล้วกรุณาติดต่อทีมงานพร้อมสลิป หรือสร้างคำสั่งซื้อใหม่</p>
          <Link href={`/checkout/${order.planSlug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300">
            สร้างคำสั่งซื้อใหม่ <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </Panel>
      );
    case "REFUNDED":
      return (
        <Panel>
          <p className="text-sm text-gray-300">คำสั่งซื้อนี้ได้รับการคืนเงินแล้ว</p>
        </Panel>
      );
    default:
      return null;
  }
}

export default async function OrderPaymentPage({ params }: { params: { orderId: string } }) {
  const session = await getServerSession(authOptions);
  const order = session?.user ? await getOrderForUser(prisma, { userId: session.user.id, orderId: params.orderId }) : null;
  if (!order) notFound();

  const serverNow = new Date().toISOString();
  const canUploadSlip = order.phase === "AWAITING_PAYMENT" || order.phase === "SLIP_GRACE" || order.phase === "REJECTED";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-amber-400">ขั้นตอนที่ 2 จาก 2</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-bold text-white">ชำระเงิน</h1>
          <OrderStatusBadge phase={order.phase} />
        </div>
        <p className="text-sm text-gray-400">
          คำสั่งซื้อ <span className="font-mono text-gray-200">{order.orderNumber}</span> · {order.planName} · สร้างเมื่อ {formatDateTime(order.createdAt)}
        </p>
      </header>

      {order.phase === "AWAITING_PAYMENT" ? <PaymentPanel order={order} serverNow={serverNow} /> : <StatusPanel order={order} serverNow={serverNow} />}

      {canUploadSlip && (
        <Panel>
          <SlipUploadForm orderId={order.id} />
        </Panel>
      )}

      <p className="text-xs text-gray-500">
        ดูคำสั่งซื้อทั้งหมดได้ที่{" "}
        <Link href="/account/orders" className="text-amber-400 underline underline-offset-2">ประวัติคำสั่งซื้อ</Link>
      </p>
    </div>
  );
}
