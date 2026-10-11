import Link from "next/link";
import { Users, ClipboardCheck, ArrowRight, PowerOff, Activity, DollarSign, Clock, UserX } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/page-guard";
import { getDashboardStats } from "@/lib/admin/dashboard";
import { prisma } from "@/lib/prisma";
import { formatBaht } from "@/lib/format";
import { PAYMENT_RULES } from "@/config/payment";

export const dynamic = "force-dynamic";

const PAYMENT_CLOSED_REASON = {
  DISABLED: "ปิดรับชั่วคราว",
  MAINTENANCE: "ปิดปรับปรุงระบบ",
  NOT_CONFIGURED: "ยังไม่ได้ตั้งบัญชี PromptPay",
} as const;

function StatCard({ label, icon, value, valueClass = "text-white", children }: {
  label: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  valueClass?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="glass-panel rounded-2xl p-5 border border-white/10">
      <div className="flex items-center justify-between text-gray-400 mb-2">
        <span className="text-xs">{label}</span>
        {icon}
      </div>
      <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
      {children}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const admin = await requireAdminPage();
  const stats = await getDashboardStats(prisma);
  const { revenue, members, payments } = stats;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl glass-panel-admin border border-red-500/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-mono uppercase tracking-wider text-red-400 font-bold">ADMIN CONTROL CENTER</span>
          </div>
          <h1 className="text-2xl font-bold text-white">ภาพรวมระบบและการเงิน</h1>
          <p className="text-xs text-gray-400 mt-1">ยินดีต้อนรับ ผู้ดูแลระบบ {admin.email}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-[#161F30] border border-white/10 flex items-center gap-3">
            <span className="text-xs text-gray-400">ระบบรับชำระเงิน:</span>
            {payments.open ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> เปิดอยู่
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <PowerOff className="w-3.5 h-3.5" aria-hidden="true" /> {PAYMENT_CLOSED_REASON[payments.reason]}
              </span>
            )}
          </div>
          <Link
            href="/admin/settings"
            className="text-xs text-amber-400 hover:text-amber-300 font-medium px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20"
          >
            ตั้งค่าสวิตช์ →
          </Link>
        </div>
      </div>

      {stats.pendingDeprovision > 0 && (
        <Link
          href="/admin/status"
          className="flex items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200 hover:bg-red-500/15"
        >
          <UserX className="w-5 h-5 shrink-0 text-red-400" aria-hidden="true" />
          <span>
            มี <strong className="text-white">{stats.pendingDeprovision}</strong> ช่วงสิทธิ์ที่หมดอายุ/ถูกปิดแล้ว แต่ยังบันทึกว่าเปิดสิทธิ์ใน TradingView / Discord / Telegram — ต้องถอดสิทธิ์ด้วยมือ
          </span>
          <ArrowRight className="w-4 h-4 ml-auto shrink-0" aria-hidden="true" />
        </Link>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="ยอดขายสะสมสุทธิ" icon={<DollarSign className="w-4 h-4 text-emerald-400" aria-hidden="true" />} value={`${formatBaht(revenue.net)} ฿`}>
          <span className="text-[11px] text-gray-400 block mt-1">
            รับเข้า {formatBaht(revenue.gross)} ฿ จาก {revenue.paidOrders} ออเดอร์
            {revenue.refunded > 0 && <> · คืนเงิน {formatBaht(revenue.refunded)} ฿</>}
          </span>
        </StatCard>

        <StatCard label="สลิปรอตรวจสอบ" icon={<ClipboardCheck className="w-4 h-4 text-amber-400" aria-hidden="true" />} value={stats.pendingReview} valueClass="text-amber-400">
          <Link href="/admin/orders?tab=review" className="text-[11px] text-amber-300 hover:underline block mt-1">
            ไปตรวจสอบทันที →
          </Link>
        </StatCard>

        <StatCard label="สมาชิกที่กำลังใช้งาน" icon={<Users className="w-4 h-4 text-blue-400" aria-hidden="true" />} value={members.active}>
          <span className="text-[11px] text-gray-400 block mt-1">ผู้ใช้ทั้งหมดในระบบ: {stats.totalUsers} บัญชี</span>
        </StatCard>

        <StatCard
          label={`ใกล้หมดอายุใน ${PAYMENT_RULES.expiryReminderDays} วัน`}
          icon={<Clock className="w-4 h-4 text-pink-400" aria-hidden="true" />}
          value={members.expiringSoon}
          valueClass="text-pink-400"
        >
          <span className="text-[11px] text-gray-400 block mt-1">นับรายคน — คนที่ต่ออายุทบวันไว้แล้วไม่นับ</span>
        </StatCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl p-6 border border-white/10">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-emerald-400" aria-hidden="true" />
            การจัดการออเดอร์และการเงิน
          </h2>
          <p className="text-xs text-gray-400 mb-4">ตรวจสลิปโอนเงิน PromptPay อนุมัติสิทธิ์ ปฏิเสธ หรือบันทึกการคืนเงิน — ทุกการกระทำบันทึก Audit Log</p>
          <Link
            href="/admin/orders"
            className="inline-flex px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all items-center gap-2"
          >
            <span>เปิดรายการออเดอร์</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-white/10">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" aria-hidden="true" />
            สถานะความพร้อมของระบบ (System Health)
          </h2>
          <p className="text-xs text-gray-400 mb-4">ตรวจการเชื่อมต่อฐานข้อมูล, ตัวแปรสภาพแวดล้อม (ไม่แสดงค่าความลับ) และคิวงานที่ค้าง</p>
          <Link
            href="/admin/status"
            className="inline-flex px-4 py-2.5 rounded-xl text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all items-center gap-2"
          >
            <span>ตรวจสอบสถานะเซิร์ฟเวอร์</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
