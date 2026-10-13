import Link from "next/link";
import { Users, ClipboardCheck, ArrowRight, PowerOff, Activity, DollarSign, Clock, UserX } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/page-guard";
import { getDashboardStats } from "@/lib/admin/dashboard";
import { prisma } from "@/lib/prisma";
import { formatBaht } from "@/lib/format";
import { PAYMENT_RULES } from "@/config/payment";
import { AdminPageHeader } from "@/components/admin/admin-ui";

export const dynamic = "force-dynamic";

const PAYMENT_CLOSED_REASON = {
  DISABLED: "ปิดรับชั่วคราว",
  MAINTENANCE: "ปิดปรับปรุงระบบ",
  NOT_CONFIGURED: "ยังไม่ได้ตั้งบัญชี PromptPay",
} as const;

/** ช่องตัวเลขในตารางกรอบ (วางใน grid ที่มี gap-px บนพื้นสีเส้น) */
function StatCard({ label, icon, value, valueClass = "text-white", children }: {
  label: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  valueClass?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-ink p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 text-gray-400">
        <span className="text-xs">{label}</span>
        {icon}
      </div>
      <div className={`mt-3 font-display text-3xl font-bold tracking-tight tabular-nums ${valueClass}`}>{value}</div>
      {children}
    </div>
  );
}

const outlineLink =
  "inline-flex items-center gap-2 border border-line px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-signal hover:bg-signal hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal rounded-xl";

export default async function AdminDashboardPage() {
  const admin = await requireAdminPage();
  const stats = await getDashboardStats(prisma);
  const { revenue, members, payments } = stats;

  return (
    <div className="space-y-8">
      <AdminPageHeader title="ภาพรวมระบบและการเงิน" description={`ยินดีต้อนรับ ผู้ดูแลระบบ ${admin.email}`}>
        <div className="flex flex-wrap items-stretch border border-line rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <span className="text-xs text-gray-400">ระบบรับชำระเงิน</span>
            {payments.open ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-signal">
                <span aria-hidden="true" className="w-2 h-2 bg-signal rounded-full" /> เปิดอยู่
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-300">
                <PowerOff className="w-4 h-4" aria-hidden="true" /> {PAYMENT_CLOSED_REASON[payments.reason]}
              </span>
            )}
          </div>
          <Link
            href="/admin/settings"
            className="flex items-center border-l border-line px-4 py-2.5 text-sm font-semibold text-signal transition-colors hover:bg-signal hover:text-ink"
          >
            ตั้งค่าสวิตช์ →
          </Link>
        </div>
      </AdminPageHeader>

      {stats.pendingDeprovision > 0 && (
        <Link
          href="/admin/status"
          className="flex items-center gap-3 border border-red-400/60 bg-red-500/10 p-4 text-sm text-red-100 transition-colors hover:bg-red-500/15 rounded-2xl"
        >
          <UserX className="w-5 h-5 shrink-0 text-red-300" aria-hidden="true" />
          <span>
            มี <strong className="text-white">{stats.pendingDeprovision}</strong> ช่วงสิทธิ์ที่หมดอายุ/ถูกปิดแล้ว แต่ยังบันทึกว่าเปิดสิทธิ์ใน TradingView / Discord / Telegram — ต้องถอดสิทธิ์ด้วยมือ
          </span>
          <ArrowRight className="w-4 h-4 ml-auto shrink-0" aria-hidden="true" />
        </Link>
      )}

      <div className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4 rounded-2xl overflow-hidden">
        <StatCard label="ยอดขายสะสมสุทธิ" icon={<DollarSign className="w-4 h-4 text-signal" aria-hidden="true" />} value={`${formatBaht(revenue.net)} ฿`}>
          <span className="mt-2 block text-xs text-gray-400">
            รับเข้า {formatBaht(revenue.gross)} ฿ จาก {revenue.paidOrders} ออเดอร์
            {revenue.refunded > 0 && <> · คืนเงิน {formatBaht(revenue.refunded)} ฿</>}
          </span>
        </StatCard>

        <StatCard
          label="สลิปรอตรวจสอบ"
          icon={<ClipboardCheck className="w-4 h-4 text-amber-300" aria-hidden="true" />}
          value={stats.pendingReview}
          valueClass={stats.pendingReview > 0 ? "text-amber-300" : "text-white"}
        >
          <Link href="/admin/orders?tab=review" className="mt-2 block text-xs font-semibold text-signal hover:underline">
            ไปตรวจสอบทันที →
          </Link>
        </StatCard>

        <StatCard label="สมาชิกที่กำลังใช้งาน" icon={<Users className="w-4 h-4 text-signal" aria-hidden="true" />} value={members.active}>
          <span className="mt-2 block text-xs text-gray-400">ผู้ใช้ทั้งหมดในระบบ: {stats.totalUsers} บัญชี</span>
        </StatCard>

        <StatCard
          label={`ใกล้หมดอายุใน ${PAYMENT_RULES.expiryReminderDays} วัน`}
          icon={<Clock className="w-4 h-4 text-amber-300" aria-hidden="true" />}
          value={members.expiringSoon}
          valueClass={members.expiringSoon > 0 ? "text-amber-300" : "text-white"}
        >
          <span className="mt-2 block text-xs text-gray-400">นับรายคน — คนที่ต่ออายุทบวันไว้แล้วไม่นับ</span>
        </StatCard>
      </div>

      <div className="grid gap-px border border-line bg-line md:grid-cols-2 rounded-2xl overflow-hidden">
        <div className="bg-ink p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
            <ClipboardCheck className="w-5 h-5 text-signal" aria-hidden="true" />
            การจัดการออเดอร์และการเงิน
          </h2>
          <p className="mt-2 mb-5 text-sm text-gray-400">ตรวจสลิปโอนเงิน PromptPay อนุมัติสิทธิ์ ปฏิเสธ หรือบันทึกการคืนเงิน — ทุกการกระทำบันทึก Audit Log</p>
          <Link href="/admin/orders" className={outlineLink}>
            เปิดรายการออเดอร์
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="bg-ink p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
            <Activity className="w-5 h-5 text-signal" aria-hidden="true" />
            สถานะความพร้อมของระบบ
          </h2>
          <p className="mt-2 mb-5 text-sm text-gray-400">ตรวจการเชื่อมต่อฐานข้อมูล ตัวแปรสภาพแวดล้อม (ไม่แสดงค่าความลับ) งานอัตโนมัติ และคิวงานที่ค้าง</p>
          <Link href="/admin/status" className={outlineLink}>
            ตรวจสอบสถานะระบบ
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
