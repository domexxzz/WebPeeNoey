import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/page-guard";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatBaht, formatDateTime, formatFileSize } from "@/lib/format";
import { getAdminOrderDetail, type AdminOrderDetail } from "@/lib/admin/orders-query";
import { REJECTION_PRESETS } from "@/lib/admin/messages";
import { AUDIT_ACTIONS, type AuditAction } from "@/lib/admin/audit";
import { ActionForm } from "@/components/admin/action-form";
import { AdminCard, AdminOrderBadge, DefinitionList, inputClass, labelClass, SlipCheckBadge, SubscriptionBadge } from "@/components/admin/admin-ui";
import { QR_INTEGRITY_LABELS, SLIP_CHECK_LABELS } from "@/lib/orders/slip-notification";
import { ProvisioningPanel } from "@/components/admin/provisioning-panel";
import { approveOrderAction, refundOrderAction, rejectOrderAction } from "../../actions";

export const metadata: Metadata = { title: "ตรวจสอบคำสั่งซื้อ", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type AdminSlip = AdminOrderDetail["slips"][number];

/** ผลตรวจอัตโนมัติ — ช่วยตัดสินใจเท่านั้น การอนุมัติ/ปฏิเสธยังเป็นของแอดมินเสมอ */
function SlipCheckPanel({ slip }: { slip: AdminSlip }) {
  const verified = slip.checkStatus === "VERIFIED";
  return (
    <div className={`space-y-2 border px-3.5 py-3 text-sm rounded-xl ${verified ? "border-emerald-600/40 bg-emerald-50" : "border-line-soft"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-fg-subtle">ตรวจอัตโนมัติ</span>
        <SlipCheckBadge status={slip.checkStatus} qrIntegrity={slip.qrIntegrity} />
      </div>
      {slip.checkNote && <p className="text-fg-muted">{slip.checkNote}</p>}
      <dl className="grid gap-x-4 gap-y-1 text-xs text-fg-subtle sm:grid-cols-2">
        <div>QR: {slip.qrIntegrity ? QR_INTEGRITY_LABELS[slip.qrIntegrity] : "อ่านไม่ได้"}</div>
        {slip.transRef && <div>เลขอ้างอิง (ธนาคาร): <span className="font-mono text-fg">{slip.transRef}</span></div>}
        {!slip.transRef && slip.qrReference && (
          <div>
            เลขจาก QR (ยังไม่ยืนยัน): <span className="font-mono text-fg">{slip.qrReference}</span>
          </div>
        )}
        {slip.slipAmount !== null && <div>ยอดในสลิป: {formatBaht(slip.slipAmount)} บาท</div>}
        {slip.slipDate && <div>เวลาโอน: {formatDateTime(slip.slipDate)}</div>}
        {slip.receiverName && <div>ผู้รับ: {slip.receiverName}</div>}
        {slip.checkedAt && <div>ตรวจล่าสุด: {formatDateTime(slip.checkedAt)} (ครั้งที่ {slip.checkAttempts})</div>}
      </dl>
    </div>
  );
}

function SlipViewer({ order }: { order: AdminOrderDetail }) {
  const [latest, ...older] = order.slips;
  if (!latest) return <p className="text-sm text-fg-subtle">ยังไม่มีสลิป</p>;
  return (
    <div className="space-y-3">
      <a href={`/api/slips/${latest.id}`} target="_blank" rel="noopener noreferrer" className="group block">
        {/* สลิปเป็นไฟล์ที่ต้องตรวจสิทธิ์ทุกครั้ง จึงไม่ผ่าน image optimizer (unoptimized) */}
        <div className="relative mx-auto aspect-[9/16] max-h-[640px] w-full overflow-hidden bg-surface">
          <Image src={`/api/slips/${latest.id}`} alt={`สลิปของคำสั่งซื้อ ${order.orderNumber}`} fill unoptimized sizes="(min-width: 1024px) 420px, 100vw" className="object-contain" />
        </div>
        <span className="mt-2 inline-flex items-center gap-1 text-xs text-gold-ink group-hover:underline">
          เปิดภาพเต็ม <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </span>
      </a>
      <p className="text-xs text-fg-subtle">
        อัปโหลด {formatDateTime(latest.createdAt)} · {formatFileSize(latest.sizeBytes)} · SHA-256 {latest.hash.slice(0, 12)}…
      </p>
      <SlipCheckPanel slip={latest} />
      {older.length > 0 && (
        <p className="text-xs text-fg-subtle">ผลตรวจด้านบนเป็นของสลิปล่าสุดเท่านั้น</p>
      )}
      {older.length > 0 && (
        <details className="text-xs text-fg-subtle">
          <summary className="cursor-pointer">สลิปก่อนหน้า ({older.length})</summary>
          <ul className="mt-2 space-y-1">
            {older.map((slip) => (
              <li key={slip.id}>
                <a href={`/api/slips/${slip.id}`} target="_blank" rel="noopener noreferrer" className="text-gold-ink hover:underline">
                  {formatDateTime(slip.createdAt)}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ReviewForms({ order }: { order: AdminOrderDetail }) {
  const latest = order.slips[0];
  // เติมเฉพาะเลขที่ธนาคารยืนยัน — เลขที่แกะจาก QR ลูกค้าปลอมได้ (CRC ไม่มีกุญแจลับ) จึงไม่เติมให้
  const suggestedReference = latest?.transRef ?? "";
  const flagged = latest && latest.checkStatus !== "VERIFIED" && latest.checkStatus !== "DISABLED" && latest.checkStatus !== "PENDING";
  return (
    <div className="grid gap-4">
      <AdminCard title="อนุมัติ">
        {flagged && (
          <p className="flex items-start gap-2 text-sm text-red-700">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            ผลตรวจอัตโนมัติไม่ผ่าน ({SLIP_CHECK_LABELS[latest.checkStatus]}) — ตรวจกับแอปธนาคารให้แน่ใจก่อนอนุมัติ
          </p>
        )}
        <ActionForm action={approveOrderAction} submitLabel="อนุมัติและเปิดสิทธิ์" pendingLabel="กำลังอนุมัติ...">
          <input type="hidden" name="orderId" value={order.id} />
          <div>
            <label className={labelClass} htmlFor="referenceNo">เลขอ้างอิงธุรกรรม (จากสลิป/แอปธนาคาร)</label>
            <input id="referenceNo" name="referenceNo" required autoComplete="off" defaultValue={suggestedReference} className={inputClass} placeholder="เช่น 2026101112345678" />
            {suggestedReference && <p className="mt-1 text-xs text-fg-subtle">เติมจากเลขที่ธนาคารยืนยันผ่าน EasySlip — เทียบกับแอปธนาคารก่อนกดอนุมัติ</p>}
          </div>
          <label className="flex items-start gap-2 text-sm text-fg-muted">
            <input type="checkbox" name="confirmReceived" required className="mt-1 accent-[#B8860B]" />
            ตรวจแล้วว่ามีเงิน {formatBaht(order.amount)} บาท เข้าบัญชี {order.payment?.promptpayAccountName || "ผู้รับ"} จริง
          </label>
        </ActionForm>
      </AdminCard>
      <AdminCard title="ปฏิเสธสลิป">
        <ActionForm action={rejectOrderAction} submitLabel="ปฏิเสธสลิป" pendingLabel="กำลังบันทึก..." tone="danger">
          <input type="hidden" name="orderId" value={order.id} />
          <div>
            <label className={labelClass} htmlFor="reasonPreset">เหตุผล</label>
            <select id="reasonPreset" name="reasonPreset" className={inputClass} defaultValue="">
              <option value="">— เลือกเหตุผล —</option>
              {REJECTION_PRESETS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="reasonDetail">รายละเอียดเพิ่มเติม (ลูกค้าจะเห็นข้อความนี้)</label>
            <textarea id="reasonDetail" name="reasonDetail" rows={2} maxLength={200} className={inputClass} />
          </div>
        </ActionForm>
      </AdminCard>
    </div>
  );
}

function RefundForm({ order }: { order: AdminOrderDetail }) {
  return (
    <AdminCard title="คืนเงิน">
      <p className="flex items-start gap-2 text-xs text-orange-800">
        <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
        โอนเงินคืนให้ลูกค้าก่อน แล้วจึงบันทึกที่นี่ — ระบบจะปิดสิทธิ์ของคำสั่งซื้อนี้ทันที และคืนเงินซ้ำไม่ได้
      </p>
      <ActionForm action={refundOrderAction} submitLabel="บันทึกการคืนเงิน" pendingLabel="กำลังบันทึก..." tone="danger">
        <input type="hidden" name="orderId" value={order.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="amount">ยอดคืน (สูงสุด {formatBaht(order.amount)})</label>
            <input id="amount" name="amount" type="number" step="0.01" min="0.01" max={order.amount} defaultValue={order.amount} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="transferReference">เลขอ้างอิงการโอนคืน</label>
            <input id="transferReference" name="transferReference" autoComplete="off" className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="refundReason">เหตุผล</label>
          <input id="refundReason" name="reason" required minLength={2} maxLength={300} className={inputClass} />
        </div>
        <label className="flex items-start gap-2 text-sm text-fg-muted">
          <input type="checkbox" name="confirmRefund" required className="mt-1 accent-red-500" />
          ยืนยันว่าโอนเงินคืนให้ลูกค้าแล้ว
        </label>
      </ActionForm>
    </AdminCard>
  );
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage();
  const order = await getAdminOrderDetail(prisma, id);
  if (!order) notFound();
  // คำขอสิทธิ์ผ่าน IB มีหน้าตรวจของตัวเอง (ไม่มีสลิป/คืนเงิน)
  if (order.kind === "BROKER_IB") redirect(`/admin/broker-claims/${id}`);

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> กลับไปรายการคำสั่งซื้อ
      </Link>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-bold text-fg">{order.orderNumber}</h1>
        <AdminOrderBadge status={order.status} />
        {order.priceReason && <span className="text-xs text-fg-subtle">ราคา: {order.priceReason}</span>}
      </header>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <AdminCard title="สลิปการโอน">
          <SlipViewer order={order} />
        </AdminCard>

        <div className="space-y-6">
          <AdminCard title="ข้อมูลคำสั่งซื้อ">
            <p className="font-display text-3xl font-bold text-gold-ink">
              {formatBaht(order.amount)} <span className="text-base text-fg-subtle">บาท</span>
            </p>
            <DefinitionList
              items={[
                { label: "ลูกค้า", value: <Link href={`/admin/members/${order.user.id}`} className="text-gold-ink hover:underline">{order.user.email}</Link> },
                { label: "TradingView Username", value: order.user.tradingViewUsername ?? "—" },
                { label: "Discord User ID", value: order.user.discordUserId ?? "—" },
                { label: "แพ็กเกจ", value: `${order.plan.name} (${order.plan.durationDays} วัน)` },
                { label: "บัญชีผู้รับใน QR", value: `${order.payment?.promptpayAccountName || "—"} · ${order.payment?.promptpayTarget ?? "—"}` },
                { label: "เลขอ้างอิงธนาคาร", value: order.payment?.referenceNo ?? "—" },
                { label: "สร้างเมื่อ", value: formatDateTime(order.createdAt) },
                { label: "ยอมรับข้อกำหนด", value: order.termsAcceptedAt ? `${formatDateTime(order.termsAcceptedAt)} (v${order.termsVersion}) · IP ${order.createdIp ?? "—"}` : "—" },
              ]}
            />
            {order.rejectionReason && <p className="text-sm text-red-700">เหตุผลที่ปฏิเสธล่าสุด: {order.rejectionReason}</p>}
          </AdminCard>

          {order.status === "SLIP_SUBMITTED" && <ReviewForms order={order} />}
          {order.status === "APPROVED" && <RefundForm order={order} />}

          {order.subscription && (
            <AdminCard title="สิทธิ์จากคำสั่งซื้อนี้">
              <div className="flex flex-wrap items-center gap-3 text-sm text-fg-muted">
                <SubscriptionBadge status={order.subscription.status} />
                {formatDateTime(order.subscription.currentPeriodStart)} → {formatDateTime(order.subscription.currentPeriodEnd)}
                {order.subscription.isPriceLocked && <span className="text-xs text-gold-ink">ล็อกราคา</span>}
              </div>
              <ProvisioningPanel subscription={order.subscription} tradingViewUsername={order.user.tradingViewUsername} />
            </AdminCard>
          )}

          {order.refund && (
            <AdminCard title="การคืนเงิน">
              <p className="text-sm text-fg-muted">
                คืน {formatBaht(order.refund.amount)} บาท เมื่อ {formatDateTime(order.refund.createdAt)} — {order.refund.reason}
                {order.refund.transferReference && ` (อ้างอิง ${order.refund.transferReference})`}
              </p>
            </AdminCard>
          )}

          <AdminCard title="ประวัติการดำเนินการ">
            {order.auditLogs.length === 0 ? (
              <p className="text-sm text-fg-subtle">ยังไม่มี</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {order.auditLogs.map((log) => (
                  <li key={log.id} className="text-fg-muted">
                    <span className="text-fg">{AUDIT_ACTIONS[log.action as AuditAction] ?? log.action}</span> โดย {log.actorEmail} ·{" "}
                    <span className="text-fg-subtle">{formatDateTime(log.createdAt)}</span>
                  </li>
                ))}
              </ol>
            )}
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
