import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  ShieldAlert,
  LayoutDashboard,
  ClipboardCheck,
  Users,
  ScrollText,
  Activity,
  Sliders,
  LogOut,
  ExternalLink,
  Lock,
} from "lucide-react";
import { AccountSignOutButton } from "@/components/account-sign-out";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/admin");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/account?error=unauthorized_admin");
  }

  return (
    <div className="min-h-screen bg-[#070A0F] text-gray-200 flex flex-col md:flex-row">
      {/* Admin Sidebar */}
      <aside className="w-full md:w-64 bg-[#0D121C] border-r border-red-500/20 flex flex-col shrink-0">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-amber-600 flex items-center justify-center font-bold text-white shadow-lg">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-white tracking-wide block">
                ADMIN CONSOLE
              </span>
              <span className="text-[11px] text-red-400 font-mono flex items-center gap-1">
                <Lock className="w-2.5 h-2.5 inline" /> SECURE ROOT
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1.5 flex-1">
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
          >
            <LayoutDashboard className="w-4 h-4 text-amber-400" />
            ภาพรวมระบบ
          </Link>
          <Link
            href="/admin/orders"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
          >
            <ClipboardCheck className="w-4 h-4 text-emerald-400" />
            ตรวจสอบออเดอร์
          </Link>
          <Link
            href="/admin/members"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
          >
            <Users className="w-4 h-4 text-blue-400" />
            จัดการสมาชิก & สิทธิ์
          </Link>
          <Link
            href="/admin/audit-logs"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
          >
            <ScrollText className="w-4 h-4 text-purple-400" />
            ประวัติ Audit Logs
          </Link>
          <Link
            href="/admin/status"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
          >
            <Activity className="w-4 h-4 text-cyan-400" />
            สถานะระบบ (Health)
          </Link>
          <Link
            href="/admin/settings"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
          >
            <Sliders className="w-4 h-4 text-pink-400" />
            ตั้งค่า & Kill-switch
          </Link>
        </nav>

        {/* User profile & exit links */}
        <div className="p-4 border-t border-white/5 space-y-3 bg-[#0A0E17]">
          <div className="text-xs">
            <span className="text-gray-400 block">ผู้ดูแลระบบ:</span>
            <span className="text-white font-medium truncate block">
              {session.user.email}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <Link
              href="/account"
              className="text-xs text-gray-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> หน้าร้านค้า
            </Link>
            <AccountSignOutButton />
          </div>
        </div>
      </aside>

      {/* Admin Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Notification / Security Bar */}
        <header className="h-14 border-b border-white/5 bg-[#0D121C]/90 backdrop-blur px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-amber-300/80">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>ADMIN SECURE ZONE — Clickjacking Protection Active</span>
          </div>
          <div className="text-xs text-gray-400">
            Node: Production Ready | Time: {new Date().toLocaleTimeString("th-TH")}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
