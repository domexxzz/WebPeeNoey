import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  KeyRound,
  Calendar,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Shield,
  Send,
  AlertTriangle,
} from "lucide-react";

export default async function AccountDashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  // ดึงข้อมูลสมาชิกและสิทธิ์จากฐานข้อมูล
  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscriptions: {
            orderBy: { currentPeriodEnd: "desc" },
            take: 1,
            include: { plan: true },
          },
          orders: {
            orderBy: { createdAt: "desc" },
            take: 3,
            include: { plan: true },
          },
        },
      })
    : null;

  const currentSub = user?.subscriptions?.[0];
  const isActive = currentSub && currentSub.status === "ACTIVE" && new Date(currentSub.currentPeriodEnd) > new Date();

  return (
    <div className="space-y-8">
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl glass-panel p-6 sm:p-8 border border-white/10">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>แดชบอร์ดสมาชิก Peenoey Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              ยินดีต้อนรับ, {user?.name || user?.email}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              ตรวจสอบสิทธิ์การใช้งานอินดิเคเตอร์ วันหมดอายุ และช่องทางคอมมูนิตี้ VIP ของคุณ
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/#pricing"
              className="px-5 py-2.5 rounded-xl font-medium text-sm text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition-all shadow-glow flex items-center gap-2"
            >
              <span>{isActive ? "ต่ออายุแพ็กเกจ (ทบวัน)" : "สมัครสมาชิกใหม่"}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Subscription Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 glass-panel rounded-2xl p-6 border border-white/10 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-semibold text-white">
                สถานะสมาชิกปัจจุบัน
              </h2>
            </div>
            {isActive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                กำลังใช้งาน (Active)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-500/10 border border-gray-500/30 text-gray-400">
                ยังไม่มีสิทธิ์ที่ใช้งานอยู่
              </span>
            )}
          </div>

          {isActive && currentSub ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#161F30] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-gray-400 block">แพ็กเกจที่ใช้งาน</span>
                  <span className="text-lg font-bold text-amber-400">
                    {currentSub.plan.name}
                  </span>
                  {currentSub.isPriceLocked && (
                    <span className="inline-block mt-1 text-[11px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      🔒 ล็อกสิทธิ์ราคาโปรโมชันตลอดอายุ
                    </span>
                  )}
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-xs text-gray-400 block">วันหมดอายุ</span>
                  <span className="text-sm font-semibold text-white flex items-center sm:justify-end gap-1.5 mt-0.5">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    {new Date(currentSub.currentPeriodEnd).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <span className="text-xs text-gray-300">TradingView</span>
                  {currentSub.tradingViewGranted ? (
                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> ได้สิทธิ์แล้ว
                    </span>
                  ) : (
                    <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> รอระบบอัปเดต
                    </span>
                  )}
                </div>
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <span className="text-xs text-gray-300">กลุ่ม Telegram</span>
                  <Link
                    href={process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM || "https://t.me/peenoey_support"}
                    target="_blank"
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" /> ลิงก์เข้าร่วม
                  </Link>
                </div>
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <span className="text-xs text-gray-300">Discord VIP</span>
                  <span className="text-xs text-purple-400 font-medium">
                    {currentSub.discordRoleGranted ? "เชื่อมต่อแล้ว" : "รอยืนยันยศ"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <Shield className="w-6 h-6" />
              </div>
              <p className="text-sm text-gray-300">
                คุณยังไม่มีแพ็กเกจสมาชิกที่ใช้งานอยู่ หรือแพ็กเกจเดิมหมดอายุแล้ว
              </p>
              <Link
                href="/#pricing"
                className="inline-flex items-center gap-2 text-xs font-medium text-amber-400 hover:text-amber-300"
              >
                ดูรายละเอียดแพ็กเกจและโปรโมชัน <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* User Account Info Card */}
        <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-4">
          <h2 className="text-base font-semibold text-white">ข้อมูลบัญชีของคุณ</h2>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-gray-400 block">อีเมลสมาชิก</span>
              <span className="text-gray-200 font-medium">{user?.email}</span>
            </div>
            <div>
              <span className="text-gray-400 block">TradingView Username</span>
              <span className="text-gray-200 font-medium">
                {user?.tradingViewUsername || "ยังไม่ได้ระบุ (แจ้งแอดมินเพื่อขอสิทธิ์)"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block">วันที่สมัครสมาชิก</span>
              <span className="text-gray-200 font-medium">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("th-TH")
                  : "-"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders List */}
      <div className="glass-panel rounded-2xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">
            ประวัติคำสั่งซื้อล่าสุด
          </h2>
          <Link
            href="/account/orders"
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            ดูทั้งหมด →
          </Link>
        </div>

        {!user?.orders || user.orders.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">
            ยังไม่มีประวัติคำสั่งซื้อในระบบ
          </p>
        ) : (
          <div className="divide-y divide-white/5">
            {user.orders.map((order) => (
              <div
                key={order.id}
                className="py-3 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-mono text-gray-300 block">
                    {order.orderNumber}
                  </span>
                  <span className="text-gray-500">
                    {order.plan.name} •{" "}
                    {new Date(order.createdAt).toLocaleDateString("th-TH")}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-white block">
                    {Number(order.amount).toLocaleString()} บาท
                  </span>
                  <span
                    className={`text-[11px] font-medium ${
                      order.status === "APPROVED"
                        ? "text-emerald-400"
                        : order.status === "SLIP_SUBMITTED"
                        ? "text-amber-400"
                        : order.status === "PENDING_PAYMENT"
                        ? "text-blue-400"
                        : "text-red-400"
                    }`}
                  >
                    {order.status === "APPROVED"
                      ? "อนุมัติแล้ว"
                      : order.status === "SLIP_SUBMITTED"
                      ? "รอตรวจสลิป"
                      : order.status === "PENDING_PAYMENT"
                      ? "รอชำระเงิน"
                      : "ปฏิเสธ/ยกเลิก"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
