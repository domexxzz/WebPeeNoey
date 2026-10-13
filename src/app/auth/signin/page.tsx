"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { safeCallbackUrl } from "@/lib/safe-redirect";
import Link from "next/link";
import { Lock, Mail, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";

function SignInContent() {
  const searchParams = useSearchParams();
  // กัน Open Redirect: ยอมรับเฉพาะ path ภายในเว็บ
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
        callbackUrl,
      });

      if (res?.error) {
        setError(res.error);
        setLoading(false);
      } else {
        // โหลดหน้าใหม่ทั้งหน้า: router.push + router.refresh แข่งกัน และ refresh หน้า signin ขณะล็อกอินแล้ว
        // ทำให้ middleware เด้งไป /account ทับปลายทางที่ผู้ใช้ตั้งใจไป (เช่น หน้าชำระเงิน)
        window.location.assign(callbackUrl);
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md border border-line bg-ink p-6 sm:p-8 rounded-2xl">
      {/* Brand Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">เข้าสู่ระบบสมาชิก</h1>
        <p className="text-sm text-gray-400 mt-1">
          เข้าใช้งานอินดิเคเตอร์และคอมมูนิตี้สำหรับสมาชิก
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-6 p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2.5 rounded-xl">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="signin-field-1" className="block text-xs font-medium text-gray-300 mb-1.5">
            อีเมล
          </label>
          <div className="relative">
            <Mail className="w-5 h-5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="signin-field-1"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full bg-ink-raised border border-line py-2.5 pl-11 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-signal transition-colors rounded-xl"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="signin-field-2" className="text-xs font-medium text-gray-300">
              รหัสผ่าน
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-signal hover:text-signal-hover transition-colors"
            >
              ลืมรหัสผ่าน?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-5 h-5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="signin-field-2"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-ink-raised border border-line py-2.5 pl-11 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-signal transition-colors rounded-xl"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3 px-4 font-medium text-ink bg-signal hover:bg-signal-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50 rounded-xl"
        >
          {loading ? (
            <span className="inline-block animate-pulse">กำลังเข้าสู่ระบบ...</span>
          ) : (
            <>
              <span>เข้าสู่ระบบ</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-line text-center">
        <p className="text-sm text-gray-400">
          ยังไม่มีบัญชีสมาชิก?{" "}
          <Link
            href={callbackUrl === "/account" ? "/auth/signup" : `/auth/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="text-signal hover:text-signal-hover font-medium transition-colors"
          >
            สมัครสมาชิกใหม่
          </Link>
        </p>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
        <ShieldCheck className="w-4 h-4 text-signal" />
        <span>เชื่อมต่อแบบเข้ารหัส (HTTPS)</span>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="w-full flex justify-center">
      <Suspense fallback={<div className="text-gray-400 text-sm">กำลังโหลด...</div>}>
        <SignInContent />
      </Suspense>
    </div>
  );
}
