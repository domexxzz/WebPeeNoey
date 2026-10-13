"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }

    if (newPassword.length < 8) {
      setError("รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          token,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาดในการตั้งรหัสผ่านใหม่");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        router.push("/auth/signin");
      }, 2500);
    } catch {
      setError("ไม่สามารถติดต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md border border-line bg-ink p-6 sm:p-8 rounded-2xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">ตั้งรหัสผ่านใหม่</h1>
        <p className="text-sm text-gray-400 mt-1">
          ระบุรหัสผ่านใหม่สำหรับบัญชี {email ? `(${email})` : ""}
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-6 p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2.5 rounded-xl">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success ? (
        <div className="text-center space-y-4 py-4">
          <div className="w-14 h-14 bg-signal-muted border border-signal text-signal flex items-center justify-center mx-auto rounded-xl">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">ตั้งรหัสผ่านใหม่สำเร็จ!</h2>
            <p className="text-sm text-gray-400 mt-1">
              ระบบกำลังพาท่านไปหน้าเข้าสู่ระบบอัตโนมัติ...
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/auth/signin"
              className="text-sm text-signal hover:text-signal-hover font-medium"
            >
              คลิกที่นี่หากหน้าเว็บไม่เปลี่ยน
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reset-password-field-1" className="block text-xs font-medium text-gray-300 mb-1.5">
              รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="reset-password-field-1"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-ink-raised border border-line py-2.5 pl-11 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-signal transition-colors rounded-xl"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reset-password-field-2" className="block text-xs font-medium text-gray-300 mb-1.5">
              ยืนยันรหัสผ่านใหม่อีกครั้ง
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="reset-password-field-2"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              <span className="inline-block animate-pulse">กำลังบันทึก...</span>
            ) : (
              <>
                <span>ยืนยันรหัสผ่านใหม่</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="w-full flex justify-center">
      <Suspense fallback={<div className="text-gray-400 text-sm">กำลังโหลด...</div>}>
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
