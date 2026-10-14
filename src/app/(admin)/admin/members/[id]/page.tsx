import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/page-guard";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { daysUntil, formatBaht, formatDate, formatDateTime } from "@/lib/format";
import { getMemberDetail } from "@/lib/admin/members";
import { ActionForm } from "@/components/admin/action-form";
import { AdminCard, AdminOrderBadge, DefinitionList, inputClass, labelClass, SubscriptionBadge } from "@/components/admin/admin-ui";
import { ProvisioningPanel } from "@/components/admin/provisioning-panel";
import { revokeMemberAction } from "../../actions";

export const metadata: Metadata = { title: "รายละเอียดสมาชิก", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage();
  const now = new Date();
  const member = await getMemberDetail(prisma, { userId: id, now });
  if (!member) notFound();
  const { membership } = member;

  return (
    <div className="space-y-6">
      <Link href="/admin/members" className="inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> กลับไปรายชื่อสมาชิก
      </Link>
      <h1 className="font-display text-2xl font-bold text-fg break-all">{member.email}</h1>

      <AdminCard title="ข้อมูลสมาชิก">
        <DefinitionList
          items={[
            { label: "ชื่อ", value: member.name ?? "—" },
            { label: "บทบาท", value: member.role === "ADMIN" ? "แอดมิน" : "สมาชิก" },
            { label: "TradingView Username", value: member.tradingViewUsername ?? "—" },
            { label: "Discord User ID", value: member.discordUserId ?? "—" },
            { label: "สมัครเมื่อ", value: formatDateTime(member.createdAt) },
            {
              label: "สถานะสิทธิ์",
              value: membership.active && membership.endsAt ? `ใช้งานได้ถึง ${formatDate(membership.endsAt)} (อีก ${daysUntil(membership.endsAt, now)} วัน)` : "ไม่มีสิทธิ์ที่ใช้งานอยู่",
            },
          ]}
        />
      </AdminCard>

      <AdminCard title="ช่วงสิทธิ์ทั้งหมด">
        {member.subscriptions.length === 0 ? (
          <p className="text-sm text-fg-subtle">ยังไม่มี</p>
        ) : (
          <ul className="space-y-4">
            {member.subscriptions.map((subscription) => (
              <li key={subscription.id} className="border border-line p-4 space-y-3 rounded-2xl">
                <div className="flex flex-wrap items-center gap-3 text-sm text-fg-muted">
                  <SubscriptionBadge status={subscription.status} />
                  <span>{subscription.plan.name}</span>
                  <span>{formatDate(subscription.currentPeriodStart)} → {formatDate(subscription.currentPeriodEnd)}</span>
                  <span className="font-mono text-xs text-fg-subtle">{subscription.order.orderNumber}</span>
                  {subscription.isPriceLocked && subscription.lockedPrice !== null && (
                    <span className="text-xs text-gold-ink">ล็อกราคา {formatBaht(subscription.lockedPrice)}</span>
                  )}
                </div>
                {subscription.revocationReason && <p className="text-xs text-red-700">ปิดสิทธิ์: {subscription.revocationReason}</p>}
                {(subscription.status === "ACTIVE" || subscription.status === "EXPIRING_SOON" || subscription.tradingViewGranted || subscription.discordRoleGranted || subscription.telegramGranted) && (
                  <ProvisioningPanel subscription={subscription} />
                )}
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <AdminCard title="คำสั่งซื้อ">
        {member.orders.length === 0 ? (
          <p className="text-sm text-fg-subtle">ยังไม่มี</p>
        ) : (
          <ul className="divide-y divide-line-soft text-sm">
            {member.orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/admin/orders/${order.id}`} className="font-mono text-gold-ink hover:underline">{order.orderNumber}</Link>
                <span className="text-fg-subtle">{order.plan.name} · {formatDate(order.createdAt)}</span>
                <span className="font-mono text-fg">{formatBaht(order.amount)}</span>
                <AdminOrderBadge status={order.status} />
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      {membership.active && (
        <AdminCard title="ปิดสิทธิ์ฉุกเฉิน" className="border-red-500/40">
          <p className="text-xs text-red-800">ปิดทุกช่วงสิทธิ์ที่ใช้งานอยู่และที่รอเริ่มทันที ใช้เมื่อพบการละเมิดข้อกำหนด (เช่น แชร์บัญชี) — ไม่ใช่การคืนเงิน</p>
          <ActionForm action={revokeMemberAction} submitLabel="ปิดสิทธิ์ทันที" pendingLabel="กำลังปิดสิทธิ์..." tone="danger">
            <input type="hidden" name="userId" value={member.id} />
            <div>
              <label className={labelClass} htmlFor="revokeReason">เหตุผล (บันทึกใน Audit Log)</label>
              <input id="revokeReason" name="reason" required minLength={2} maxLength={300} className={inputClass} />
            </div>
            <label className="flex items-start gap-2 text-sm text-fg-muted">
              <input type="checkbox" name="confirmRevoke" required className="mt-1 accent-red-500" />
              ยืนยันการปิดสิทธิ์ของ {member.email}
            </label>
          </ActionForm>
        </AdminCard>
      )}
    </div>
  );
}
