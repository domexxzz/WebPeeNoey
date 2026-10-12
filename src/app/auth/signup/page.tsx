"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { safeCallbackUrl } from "@/lib/safe-redirect";
import { User, Mail, Lock, LineChart, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tradingViewUsername, setTradingViewUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          tradingViewUsername,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาดในการสมัครสมาชิก");
        setLoading(false);
        return;
      }

      // สมัครสำเร็จ ให้เข้าสู่ระบบอัตโนมัติ
      const loginRes = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (loginRes?.ok) {
        // กลับไปหน้าที่ผู้ใช้ตั้งใจไป (เช่น หน้าชำระเงิน) — อ่านจาก URL ตอนกดส่ง จึงไม่ต้องใช้ useSearchParams/Suspense
        // โหลดหน้าใหม่ทั้งหน้า (ไม่ใช้ router.push + refresh ที่แข่งกันจน middleware เด้งไป /account)
        window.location.assign(safeCallbackUrl(new URLSearchParams(window.location.search).get("callbackUrl")));
      } else {
        router.push("/auth/signin?registered=true");
      }
    } catch {
      setError("ไม่สามารถติดต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex justify-center">

      <div className="w-full max-w-md border border-line bg-ink p-6 sm:p-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">สมัครสมาชิกใหม่</h1>
          <p className="text-sm text-gray-400 mt-1">
            เริ่มต้นใช้งานระบบเทรดและเครื่องมือวิเคราะห์ระดับโปร
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-6 p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="signup-field-1" className="block text-xs font-medium text-gray-300 mb-1.5">
              ชื่อ-นามสกุล หรือชื่อเล่น
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="signup-field-1"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="สมชาย ใจดี"
                className="w-full bg-ink-raised border border-line py-2.5 pl-11 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-signal transition-colors"
              />
            </div>
          </div>

          <div>
            <label htmlFor="signup-field-2" className="block text-xs font-medium text-gray-300 mb-1.5">
              อีเมล
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="signup-field-2"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-ink-raised border border-line py-2.5 pl-11 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-signal transition-colors"
              />
            </div>
          </div>

          <div>
            <label htmlFor="signup-field-3" className="block text-xs font-medium text-gray-300 mb-1.5">
              รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="signup-field-3"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-ink-raised border border-line py-2.5 pl-11 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-signal transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="signup-field-4" className="text-xs font-medium text-gray-300">
                TradingView Username
              </label>
              <span className="text-[11px] text-gray-400">สำหรับรับสิทธิ์อินดิเคเตอร์</span>
            </div>
            <div className="relative">
              <LineChart className="w-5 h-5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="signup-field-4"
                type="text"
                value={tradingViewUsername}
                onChange={(e) => setTradingViewUsername(e.target.value)}
                maxLength={50}
                placeholder="ชื่อบัญชีใน TradingView (ไม่ใส่ก็ได้)"
                className="w-full bg-ink-raised border border-line py-2.5 pl-11 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-signal transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 py-3 px-4 font-medium text-ink bg-signal hover:bg-signal-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block animate-pulse">กำลังสร้างบัญชี...</span>
            ) : (
              <>
                <span>สร้างบัญชีสมาชิก</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-line text-center">
          <p className="text-sm text-gray-400">
            มีบัญชีสมาชิกอยู่แล้ว?{" "}
            <Link
              href="/auth/signin"
              className="text-signal hover:text-signal-hover font-medium transition-colors"
            >
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
