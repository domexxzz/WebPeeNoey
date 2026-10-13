"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function AccountSignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="p-2 text-gray-400 hover:text-white hover:bg-white/5 border border-line transition-all text-xs flex items-center gap-1.5 rounded-xl"
      title="ออกจากระบบ"
    >
      <LogOut className="w-4 h-4 text-red-400" />
      <span className="hidden sm:inline">ออกจากระบบ</span>
    </button>
  );
}
