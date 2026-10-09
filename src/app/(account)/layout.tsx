import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { 
  LayoutDashboard, 
  KeyRound, 
  Receipt, 
  Home, 
  ShieldAlert,
  Sparkles
} from "lucide-react";
import { AccountSignOutButton } from "@/components/account-sign-out";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/account");
  }

  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className="min-h-screen bg-[#0B0F17] flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-white/10 bg-[#111827]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-black shadow-glow">
                P
              </div>
              <div>
                <span className="font-bold text-lg text-white group-hover:text-amber-400 transition-colors">
                  Peenoey
                </span>
                <span className="text-xs text-amber-400 ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 font-medium">
                  Portal
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/account"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-200 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <LayoutDashboard className="w-4 h-4 text-amber-400" />
                แดชบอร์ด
              </Link>
              <Link
                href="/account/subscriptions"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <KeyRound className="w-4 h-4 text-emerald-400" />
                สิทธิ์การใช้งาน
              </Link>
              <Link
                href="/account/orders"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <Receipt className="w-4 h-4 text-blue-400" />
                ประวัติคำสั่งซื้อ
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all flex items-center gap-1.5"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                ระบบจัดการหลังบ้าน
              </Link>
            )}

            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-medium text-white truncate max-w-[150px]">
                {session.user.name || session.user.email}
              </span>
              <span className="text-xs text-gray-400 flex items-center justify-end gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                {session.user.role === "ADMIN" ? "แอดมิน" : "สมาชิกทั่วไป"}
              </span>
            </div>

            <AccountSignOutButton />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Peenoey Indicator. สงวนลิขสิทธิ์ทั้งหมด</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-gray-300 transition-colors flex items-center gap-1">
              <Home className="w-3.5 h-3.5" /> หน้าแรก
            </Link>
            <Link href="/guide" className="hover:text-gray-300 transition-colors">คู่มือการใช้งาน</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">เงื่อนไข</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">ความเป็นส่วนตัว</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
