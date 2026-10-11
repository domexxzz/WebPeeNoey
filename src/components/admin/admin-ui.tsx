import type { OrderStatus, SubscriptionStatus } from "@prisma/client";
import { OrderStatusBadge } from "@/components/checkout/order-status-badge";
import type { OrderPhase } from "@/lib/orders/phase";

/** สถานะออเดอร์ในฐานข้อมูล → ป้ายเดียวกับที่ลูกค้าเห็น */
export function AdminOrderBadge({ status }: { status: OrderStatus }) {
  const phase: OrderPhase = status === "PENDING_PAYMENT" ? "AWAITING_PAYMENT" : status;
  return <OrderStatusBadge phase={phase} />;
}

const SUBSCRIPTION_LABELS: Record<SubscriptionStatus, { label: string; className: string }> = {
  ACTIVE: { label: "ใช้งานอยู่", className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  EXPIRING_SOON: { label: "ใกล้หมดอายุ", className: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  EXPIRED: { label: "หมดอายุ", className: "bg-white/5 text-gray-300 border-white/10" },
  REVOKED: { label: "ถูกปิดสิทธิ์", className: "bg-red-500/10 text-red-300 border-red-500/30" },
};

export function SubscriptionBadge({ status }: { status: SubscriptionStatus }) {
  const { label, className } = SUBSCRIPTION_LABELS[status];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}>{label}</span>;
}

export function AdminPageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-heading text-2xl font-bold text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-400">{description}</p>}
      </div>
      {children}
    </header>
  );
}

export function AdminCard({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl glass-panel-admin p-5 space-y-4 ${className}`}>
      {title && <h2 className="font-heading text-base font-semibold text-white">{title}</h2>}
      {children}
    </section>
  );
}

export function DefinitionList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 text-sm">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg bg-black/20 px-3 py-2">
          <dt className="text-xs text-gray-400">{item.label}</dt>
          <dd className="mt-0.5 text-white break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pagination({ page, pageSize, total, href }: { page: number; pageSize: number; total: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="เปลี่ยนหน้า" className="flex items-center justify-between text-sm text-gray-400">
      <span>
        หน้า {page} จาก {pages} ({total} รายการ)
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <a href={href(page - 1)} className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/5">
            ก่อนหน้า
          </a>
        )}
        {page < pages && (
          <a href={href(page + 1)} className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/5">
            ถัดไป
          </a>
        )}
      </div>
    </nav>
  );
}

export const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-amber-400 focus:outline-none";
export const labelClass = "block text-xs font-medium text-gray-300 mb-1";
