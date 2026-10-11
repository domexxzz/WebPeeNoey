"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Menu, X } from "lucide-react";
import type { NavLink } from "@/config/marketing";

const PANEL_ID = "mobile-nav-panel";

export function MobileNav({ links }: { links: NavLink[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const { status } = useSession();
  // ลิงก์เข้าสู่ระบบในเมนูมีไว้สำหรับจอ < 640px ที่ซ่อนปุ่มนี้จาก header — แสดงเฉพาะผู้ที่ยังไม่ล็อกอิน
  const showSignIn = status === "unauthenticated";

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      toggleRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <div className="md:hidden">
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={PANEL_ID}
        aria-label={isOpen ? "ปิดเมนู" : "เปิดเมนู"}
        className="p-2 -mr-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5"
      >
        {isOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
      </button>

      {isOpen && (
        <nav
          id={PANEL_ID}
          aria-label="เมนูหลัก (มือถือ)"
          className="absolute left-0 right-0 top-16 border-b border-white/10 bg-[#0D121C]/95 backdrop-blur-md"
        >
          <ul className="px-4 py-3 space-y-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-3 rounded-lg text-sm text-gray-200 hover:bg-white/5 hover:text-amber-400"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {showSignIn && (
              <li className="sm:hidden">
                <Link
                  href="/auth/signin"
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-3 rounded-lg text-sm text-gray-200 hover:bg-white/5 hover:text-amber-400"
                >
                  เข้าสู่ระบบ
                </Link>
              </li>
            )}
          </ul>
        </nav>
      )}
    </div>
  );
}
