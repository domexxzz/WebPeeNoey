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
import { BrokerAccountPanel } from "@/components/admin/broker-account-panel";
import { revokeMemberAction, setMemberRoleAction } from "../../actions";

export const metadata: Metadata = { title: "รายละเอียดสมาชิก", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireAdminPage();
  const now = new Date();
  const member = await getMemberDetail(prisma, { userId: id, now });
  if (!member) notFound();
  const { membership } = member;
  const hasIbAccess = member.subscriptions.some(
    (subscription) => subscription.plan.kind === "BROKER_IB" && (subscription.status === "ACTIVE" || subscription.status === "EXPIRING_SOON") && subscription.currentPeriodEnd > now,
  );

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
                  {subscription.plan.kind === "BROKER_IB" && <span className="border border-gold px-2 py-0.5 text-xs text-gold-ink rounded-full">IB</span>}
                  <span>{formatDate(subscription.currentPeriodStart)} → {formatDate(subscription.currentPeriodEnd)}</span>
                  <span className="font-mono text-xs text-fg-subtle">{subscription.order.orderNumber}</span>
                  {subscription.isPriceLocked && subscription.lockedPrice !== null && (
                    <span className="text-xs text-gold-ink">ล็อกราคา {formatBaht(subscription.lockedPrice)}</span>
                  )}
                </div>
                {subscription.revocationReason && <p className="text-xs text-red-700">ปิดสิทธิ์: {subscription.revocationReason}</p>}
                {(subscription.status === "ACTIVE" || subscription.status === "EXPIRING_SOON" || subscription.tradingViewGranted || subscription.discordRoleGranted || subscription.telegramGranted) && (
                  <ProvisioningPanel subscription={subscription} tradingViewUsername={member.tradingViewUsername} />
                )}
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <BrokerAccountPanel userId={member.id} email={member.email} accounts={member.brokerAccounts} hasIbAccess={hasIbAccess} />

      <AdminCard title="คำสั่งซื้อ">
        {member.orders.length === 0 ? (
          <p className="text-sm text-fg-subtle">ยังไม่มี</p>
        ) : (
          <ul className="divide-y divide-line-soft text-sm">
            {member.orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={order.kind === "BROKER_IB" ? `/admin/broker-claims/${order.id}` : `/admin/orders/${order.id}`} className="font-mono text-gold-ink hover:underline">
                  {order.orderNumber}
                </Link>
                <span className="text-fg-subtle">{order.plan.name} · {formatDate(order.createdAt)}</span>
                <span className="font-mono text-fg">{order.kind === "BROKER_IB" ? "ฟรี (IB)" : formatBaht(order.amount)}</span>
                <AdminOrderBadge status={order.status} />
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <AdminCard title="สิทธิ์การใช้งานระบบ">
        <p className="text-xs text-fg-subtle">
          สิทธิ์ปัจจุบัน: <span className="font-medium text-fg">{member.role === "ADMIN" ? "แอดมิน" : "สมาชิกทั่วไป"}</span>
          {" · "}แอดมินเห็นข้อมูลลูกค้า ออเดอร์ และสั่งงานหลังบ้านได้ทั้งหมด
        </p>
        {viewer.id === member.id ? (
          <p className="text-xs text-fg-muted">นี่คือบัญชีที่คุณกำลังใช้อยู่ — เปลี่ยนสิทธิ์ตัวเองไม่ได้ ให้แอดมินอีกคนเป็นผู้เปลี่ยนให้</p>
        ) : (
          <ActionForm
            action={setMemberRoleAction}
            submitLabel={member.role === "ADMIN" ? "ลดเป็นสมาชิกทั่วไป" : "เลื่อนเป็นแอดมิน"}
            pendingLabel="กำลังเปลี่ยนสิทธิ์..."
            tone={member.role === "ADMIN" ? "danger" : undefined}
          >
            <input type="hidden" name="userId" value={member.id} />
            <input type="hidden" name="role" value={member.role === "ADMIN" ? "USER" : "ADMIN"} />
            <div>
              <label className={labelClass} htmlFor="roleReason">เหตุผล (บันทึกใน Audit Log)</label>
              <input id="roleReason" name="reason" required minLength={2} maxLength={300} className={inputClass} />
            </div>
            <label className="flex items-start gap-2 text-sm text-fg-muted">
              <input type="checkbox" name="confirmRoleChange" required className="mt-1 accent-brand" />
              {member.role === "ADMIN"
                ? `ยืนยันลดสิทธิ์แอดมินของ ${member.email}`
                : `ยืนยันให้ ${member.email} เป็นแอดมิน เข้าถึงข้อมูลลูกค้าและเงินได้ทั้งหมด`}
            </label>
            {member.role !== "ADMIN" && (
              <>
                {!member.emailVerified && (
                  // ใครก็สมัครด้วยอีเมลของคนอื่นไว้ล่วงหน้าได้ — ถ้ายังไม่ยืนยัน อย่าเพิ่งเชื่อว่าเจ้าของอีเมลคือคนที่คุมบัญชีนี้
                  <p className="text-xs font-medium text-red-800">
                    ⚠️ อีเมลของบัญชีนี้ยังไม่ผ่านการยืนยัน — ตรวจให้แน่ใจว่าเป็นคนที่คุณตั้งใจให้สิทธิ์จริง ก่อนเลื่อนขั้น
                  </p>
                )}
                <p className="text-xs text-fg-subtle">หลังเลื่อนขั้น สมาชิกต้องออกจากระบบแล้วเข้าใหม่หนึ่งครั้ง เมนูหลังบ้านถึงจะขึ้น</p>
              </>
            )}
          </ActionForm>
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
