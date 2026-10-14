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
    <div className="lg:hidden">
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={PANEL_ID}
        aria-label={isOpen ? "ปิดเมนู" : "เปิดเมนู"}
        className="p-2 -mr-2 text-fg hover:text-gold-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-ink"
      >
        {isOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
      </button>

      {isOpen && (
        <nav
          id={PANEL_ID}
          aria-label="เมนูหลัก (มือถือ)"
          className="absolute left-0 right-0 top-16 border-b border-line bg-surface"
        >
          <ul className="divide-y divide-line-soft">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="block px-5 py-4 text-base text-fg hover:bg-fg/[0.04] hover:text-gold-ink"
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
                  className="block px-5 py-4 text-base text-fg hover:bg-fg/[0.04] hover:text-gold-ink"
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
