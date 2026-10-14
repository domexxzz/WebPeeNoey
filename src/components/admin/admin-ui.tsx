import type { OrderStatus, SubscriptionStatus } from "@prisma/client";
import { OrderStatusBadge } from "@/components/checkout/order-status-badge";
import type { OrderPhase } from "@/lib/orders/phase";

/** สถานะออเดอร์ในฐานข้อมูล → ป้ายเดียวกับที่ลูกค้าเห็น */
export function AdminOrderBadge({ status }: { status: OrderStatus }) {
  const phase: OrderPhase = status === "PENDING_PAYMENT" ? "AWAITING_PAYMENT" : status;
  return <OrderStatusBadge phase={phase} />;
}

/** สีตามความหมายเดียวกับป้ายคำสั่งซื้อ: เขียว = ใช้งาน, ส้ม = ใกล้หมด, แดง = ถูกปิด, เทา = หมดอายุ */
const SUBSCRIPTION_LABELS: Record<SubscriptionStatus, { label: string; className: string }> = {
  ACTIVE: { label: "ใช้งานอยู่", className: "border-emerald-600/40 bg-emerald-50 text-emerald-800" },
  EXPIRING_SOON: { label: "ใกล้หมดอายุ", className: "border-orange-500/50 text-orange-700" },
  EXPIRED: { label: "หมดอายุ", className: "border-line-soft text-fg-subtle" },
  REVOKED: { label: "ถูกปิดสิทธิ์", className: "border-red-500/40 text-red-700" },
};

export function SubscriptionBadge({ status }: { status: SubscriptionStatus }) {
  const { label, className } = SUBSCRIPTION_LABELS[status];
  return <span className={`inline-flex items-center whitespace-nowrap border px-2.5 py-1 text-xs font-semibold rounded-full ${className}`}>{label}</span>;
}

export function AdminPageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-col items-start gap-5 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="inline-flex items-center gap-2 border border-red-500/40 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-red-700 rounded-full">
          <span aria-hidden="true" className="w-1.5 h-1.5 bg-red-400 rounded-full" />
          ADMIN
        </p>
        <h1 className="mt-4 font-display text-3xl sm:text-4xl font-bold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm text-fg-subtle leading-relaxed">{description}</p>}
      </div>
      {children}
    </header>
  );
}

export function AdminCard({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`border border-line bg-surface rounded-2xl overflow-hidden ${className}`}>
      {title && <h2 className="border-b border-line px-5 py-3.5 font-display text-base font-bold text-fg">{title}</h2>}
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

export function DefinitionList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid gap-px border border-line-soft bg-line-soft text-sm sm:grid-cols-2 rounded-2xl overflow-hidden">
      {items.map((item) => (
        <div key={item.label} className="bg-surface px-3.5 py-2.5">
          <dt className="text-xs text-fg-subtle">{item.label}</dt>
          <dd className="mt-0.5 break-words text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const pageLink =
  "border border-line px-3.5 py-1.5 text-fg transition-colors hover:bg-gold hover:text-fg hover:border-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-ink rounded-xl";

export function Pagination({ page, pageSize, total, href }: { page: number; pageSize: number; total: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="เปลี่ยนหน้า" className="flex items-center justify-between text-sm text-fg-subtle">
      <span>
        หน้า {page} จาก {pages} ({total} รายการ)
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <a href={href(page - 1)} className={pageLink}>
            ก่อนหน้า
          </a>
        )}
        {page < pages && (
          <a href={href(page + 1)} className={pageLink}>
            ถัดไป
          </a>
        )}
      </div>
    </nav>
  );
}

export const inputClass =
  "w-full border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-gold focus:outline-none rounded-xl";
export const labelClass = "block text-xs font-medium text-fg-muted mb-1";
