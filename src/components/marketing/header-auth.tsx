"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight } from "lucide-react";

const primaryButton =
  "px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-glow transition-all";

export function HeaderAuth() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="h-8 w-28 rounded-xl bg-white/5 animate-pulse" aria-hidden="true" />;
  }

  if (session?.user) {
    const isAdmin = session.user.role === "ADMIN";
    return (
      <Link href={isAdmin ? "/admin" : "/account"} className={`${primaryButton} flex items-center gap-1.5`}>
        <span>{isAdmin ? "หลังบ้านแอดมิน" : "แดชบอร์ดสมาชิก"}</span>
        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/auth/signin"
        className="hidden sm:inline-flex px-4 py-2 rounded-xl text-xs font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
      >
        เข้าสู่ระบบ
      </Link>
      <Link href="/auth/signup" className={primaryButton}>
        สมัครสมาชิก
      </Link>
    </div>
  );
}
