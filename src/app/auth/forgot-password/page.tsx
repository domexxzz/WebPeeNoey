"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, AlertCircle, ArrowRight, CheckCircle2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาดในการส่งคำขอ");
        setLoading(false);
        return;
      }

      setSubmitted(true);
      setLoading(false);
    } catch {
      setError("ไม่สามารถติดต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-md border border-line bg-ink p-6 sm:p-8 rounded-2xl">
        <div className="mb-6">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">ลืมรหัสผ่าน</h1>
          <p className="text-sm text-gray-400 mt-1">
            ระบุอีเมลที่คุณใช้ลงทะเบียนเพื่อรับลิงก์สำหรับตั้งรหัสผ่านใหม่
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-6 p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2.5 rounded-xl">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {submitted ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-14 h-14 bg-signal-muted border border-signal text-signal flex items-center justify-center mx-auto rounded-xl">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">ส่งคำขอเรียบร้อยแล้ว</h2>
              <p className="text-sm text-gray-400 mt-1">
                หากอีเมล <strong>{email}</strong> อยู่ในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปให้ทางอีเมลเรียบร้อยแล้ว กรุณาตรวจสอบกล่องจดหมายของคุณ (รวมถึงโฟลเดอร์ Junk/Spam)
              </p>
            </div>
            <div className="pt-4">
              <Link
                href="/auth/signin"
                className="inline-flex items-center gap-2 text-sm text-signal hover:text-signal-hover font-medium"
              >
                <ArrowLeft className="w-4 h-4" /> กลับสู่หน้าเข้าสู่ระบบ
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="forgot-password-field-1" className="block text-xs font-medium text-gray-300 mb-1.5">
                อีเมลของคุณ
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="forgot-password-field-1"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
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
                <span className="inline-block animate-pulse">กำลังตรวจสอบ...</span>
              ) : (
                <>
                  <span>ส่งลิงก์ตั้งรหัสผ่านใหม่</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-4">
              <Link
                href="/auth/signin"
                className="text-xs text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> ย้อนกลับไปหน้าเข้าสู่ระบบ
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
