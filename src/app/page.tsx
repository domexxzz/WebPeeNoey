import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SITE_PLANS, formatTHB } from "@/config/plans";
import { siteConfig } from "@/config/site";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  Lock,
  Layers,
  Zap,
} from "lucide-react";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col">
      {/* Navbar */}
      <header className="border-b border-white/10 bg-[#111827]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-black shadow-glow">
              P
            </div>
            <span className="font-bold text-xl text-white tracking-tight">
              {siteConfig.name}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-300">
            <a href="#features" className="hover:text-amber-400 transition-colors">จุดเด่น</a>
            <a href="#how-it-works" className="hover:text-amber-400 transition-colors">วิธีใช้งาน</a>
            <a href="#pricing" className="hover:text-amber-400 transition-colors">แพ็กเกจราคา</a>
            <Link href="/guide" className="hover:text-amber-400 transition-colors">คู่มือ</Link>
          </nav>

          <div className="flex items-center gap-3">
            {session?.user ? (
              <Link
                href={session.user.role === "ADMIN" ? "/admin" : "/account"}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-glow transition-all flex items-center gap-1.5"
              >
                <span>เข้าสู่แดชบอร์ด ({session.user.role})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  className="px-4 py-2 rounded-xl text-xs font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  เข้าสู่ระบบ
                </Link>
                <Link
                  href="/auth/signup"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-glow transition-all"
                >
                  สมัครสมาชิก
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-amber-500/15 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>TradingView Invite-only Indicator ระดับพรีเมียม</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            ยกระดับการเทรดด้วย <br />
            <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              สัญญาณเทรดแม่นยำสูง
            </span>
          </h1>

          <p className="text-base sm:text-lg text-gray-300 leading-relaxed max-w-2xl mx-auto">
            อินดิเคเตอร์คำนวณสัญญาณอัตโนมัติบน TradingView พร้อมระบบแจ้งเตือนแบบเรียลไทม์ผ่านกลุ่ม Telegram VIP และคอมมูนิตี้นักเทรดมืออาชีพ
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <a
              href="#pricing"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-glow transition-all flex items-center justify-center gap-2 text-sm"
            >
              <span>ดูแพ็กเกจ & โปรโมชันพิเศษ</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-medium text-gray-200 glass-panel hover:bg-white/10 transition-colors text-sm"
            >
              สมัครสมาชิกฟรี
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing Preview Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-white">แพ็กเกจและราคาค่าบริการ</h2>
          <p className="text-sm text-gray-400 mt-2">
            พิเศษสำหรับ 300 ท่านแรก รับราคาพิเศษพร้อมสิทธิ์ล็อกราคานี้ตลอดอายุการต่ออายุ
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SITE_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl p-6 glass-panel border transition-all flex flex-col justify-between relative ${
                plan.popular
                  ? "border-amber-500/50 shadow-glow"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-black text-[11px] font-bold uppercase tracking-wider">
                  {plan.badge}
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <p className="text-xs text-gray-400 mt-1 min-h-[32px]">
                  {plan.description}
                </p>

                <div className="mt-5 mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-amber-400">
                      {formatTHB(plan.price)}
                    </span>
                    {plan.originalPrice && (
                      <span className="text-sm text-gray-500 line-through">
                        {formatTHB(plan.originalPrice)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 block mt-1">
                    อายุการใช้งาน {plan.durationLabel}
                  </span>
                </div>

                <div className="border-t border-white/10 pt-4 space-y-2.5">
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-gray-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-white/5">
                <Link
                  href={`/auth/signup?plan=${plan.slug}`}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    plan.popular
                      ? "bg-amber-400 hover:bg-amber-300 text-black shadow-glow"
                      : "bg-white/10 hover:bg-white/20 text-white"
                  }`}
                >
                  <span>เลือกแพ็กเกจนี้</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/10 py-8 bg-[#0D121C] text-xs text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{siteConfig.name}</span>
            <span>• สัญญาณเทรดคุณภาพสูงสำหรับนักลงทุน</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-white transition-colors">เงื่อนไขการใช้บริการ</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">นโยบายความเป็นส่วนตัว</Link>
            <Link href="/refund" className="hover:text-white transition-colors">นโยบายการคืนเงิน</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
