"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function AccountSignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="p-2 text-gray-400 hover:text-white hover:bg-white/5 border border-line transition-all text-xs flex items-center gap-1.5 whitespace-nowrap rounded-xl"
      title="ออกจากระบบ"
    >
      <LogOut className="w-4 h-4 text-red-400" aria-hidden="true" />
      {/* จอเล็กเหลือแค่ไอคอน แต่ชื่อปุ่มยังอยู่ให้โปรแกรมอ่านหน้าจอ */}
      <span className="sr-only sm:not-sr-only">ออกจากระบบ</span>
    </button>
  );
}
