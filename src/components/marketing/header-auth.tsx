"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight } from "lucide-react";

const primaryButton =
  "inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap text-fg bg-gold hover:bg-gold-hover transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-ink rounded-xl";

export function HeaderAuth() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="h-9 w-28 bg-fg/5 animate-pulse" aria-hidden="true" />;
  }

  if (session?.user) {
    const isAdmin = session.user.role === "ADMIN";
    return (
      <Link href={isAdmin ? "/admin" : "/account"} className={primaryButton}>
        <span>{isAdmin ? "หลังบ้านแอดมิน" : "แดชบอร์ดสมาชิก"}</span>
        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/auth/signin"
        className="hidden sm:inline-flex px-3 py-2.5 text-xs sm:text-sm font-medium text-fg hover:text-gold-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-ink"
      >
        เข้าสู่ระบบ
      </Link>
      <Link href="/auth/signup" className={primaryButton}>
        สมัครสมาชิก
      </Link>
    </div>
  );
}
