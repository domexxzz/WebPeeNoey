import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { siteConfig } from "@/config/site";
import { FOOTER_NAV, RISK_DISCLAIMER } from "@/config/marketing";
import { staggerStyle } from "@/lib/motion";
import { BrandMark } from "./site-header";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-line text-sm text-gray-300">
      <div className="grid gap-10 px-4 sm:px-6 lg:px-10 py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
        <div data-reveal="up" className="space-y-5">
          <BrandMark size="xl" />
          <p className="max-w-sm text-gray-400 leading-relaxed">{siteConfig.description}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {FOOTER_NAV.map((group, index) => (
            <nav key={group.title} aria-label={group.title} data-reveal="up" style={staggerStyle(index + 1, 110)} className="border border-line p-6 rounded-2xl">
              <h2 className="font-display text-base font-bold text-white">{group.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-block transition-[color,transform] duration-300 hover:translate-x-1 hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <p data-reveal="up" style={staggerStyle(3, 110)} className="sm:col-span-2 flex items-start gap-3 border border-line p-6 text-xs leading-relaxed text-gray-400 rounded-2xl">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-signal" aria-hidden="true" />
            <span>{RISK_DISCLAIMER}</span>
          </p>
        </div>
      </div>

      {/* pb-20: เว้นที่ให้ปุ่มหยุดภาพเคลื่อนไหว (fixed มุมซ้ายล่าง) ไม่ทับข้อความตอนเลื่อนถึงท้ายหน้า */}
      <div className="border-t border-line px-4 sm:px-6 lg:px-10 pt-6 pb-20 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-gray-400">
        <p>
          © {year} {siteConfig.name}
        </p>
        <p>ชำระผ่าน PromptPay · ไม่มีการตัดเงินอัตโนมัติ</p>
      </div>
    </footer>
  );
}
