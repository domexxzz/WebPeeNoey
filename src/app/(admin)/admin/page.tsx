import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  TrendingUp,
  Users,
  ClipboardCheck,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  PowerOff,
  Activity,
  DollarSign,
  Clock,
} from "lucide-react";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);

  // ดึงข้อมูลภาพรวมสถิติจากฐานข้อมูล
  const [
    totalUsers,
    activeSubscriptions,
    pendingOrdersCount,
    expiringSoonCount,
    approvedOrders,
    systemSettings,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({
      where: {
        status: "ACTIVE",
        currentPeriodEnd: { gt: new Date() },
      },
    }),
    prisma.order.count({
      where: {
        status: "SLIP_SUBMITTED",
      },
    }),
    prisma.subscription.count({
      where: {
        status: "ACTIVE",
        currentPeriodEnd: {
          gt: new Date(),
          lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // อีก 3 วัน
        },
      },
    }),
    prisma.order.findMany({
      where: { status: "APPROVED" },
      select: { amount: true },
    }),
    prisma.systemSetting.findFirst(),
  ]);

  const totalRevenue = approvedOrders.reduce(
    (sum, o) => sum + Number(o.amount),
    0
  );

  return (
    <div className="space-y-8">
      {/* Header with Kill-switch status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl glass-panel-admin border border-red-500/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-mono uppercase tracking-wider text-red-400 font-bold">
              ADMIN CONTROL CENTER
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            ภาพรวมระบบและการเงิน
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            ยินดีต้อนรับ ผู้ดูแลระบบ {session?.user?.email}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-[#161F30] border border-white/10 flex items-center gap-3">
            <span className="text-xs text-gray-400">ระบบรับชำระเงิน:</span>
            {systemSettings?.paymentsEnabled ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> เปิดอยู่
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <PowerOff className="w-3.5 h-3.5" /> ปิดรับชั่วคราว (ค่าเริ่มต้น)
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

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="glass-panel rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs">ยอดขายสะสมสุทธิ</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {totalRevenue.toLocaleString()} ฿
          </div>
          <span className="text-[11px] text-emerald-400 block mt-1">
            คำนวณจากออเดอร์ที่อนุมัติแล้วจริง
          </span>
        </div>

        {/* Pending Orders */}
        <div className="glass-panel rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs">สลิปรอตรวจสอบ</span>
            <ClipboardCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">
            {pendingOrdersCount}
          </div>
          <Link
            href="/admin/orders"
            className="text-[11px] text-amber-300 hover:underline block mt-1"
          >
            ไปตรวจสอบทันที →
          </Link>
        </div>

        {/* Active Members */}
        <div className="glass-panel rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs">สมาชิกที่กำลังใช้งาน (Active)</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {activeSubscriptions}
          </div>
          <span className="text-[11px] text-gray-400 block mt-1">
            ผู้ใช้ทั้งหมดในระบบ: {totalUsers} บัญชี
          </span>
        </div>

        {/* Expiring Soon */}
        <div className="glass-panel rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs">ใกล้หมดอายุใน 3 วัน</span>
            <Clock className="w-4 h-4 text-pink-400" />
          </div>
          <div className="text-2xl font-bold text-pink-400">
            {expiringSoonCount}
          </div>
          <span className="text-[11px] text-gray-400 block mt-1">
            เตรียมส่งการแจ้งเตือนรายวัน
          </span>
        </div>
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl p-6 border border-white/10">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-emerald-400" />
            การจัดการออเดอร์และการเงิน
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            ตรวจสอบสลิปโอนเงิน PromptPay ที่ลูกค้าส่งเข้ามา อนุมัติสิทธิ์ และระบบกันกดซ้ำ
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/orders"
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all flex items-center gap-2"
            >
              <span>เปิดรายการออเดอร์</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-white/10">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            สถานะความพร้อมของระบบ (System Health)
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            ตรวจสอบการเชื่อมต่อฐานข้อมูล Neon, Resend Email, Telegram Bot และ Environment Variables
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/status"
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all flex items-center gap-2"
            >
              <span>ตรวจสอบสถานะเซิร์ฟเวอร์</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
