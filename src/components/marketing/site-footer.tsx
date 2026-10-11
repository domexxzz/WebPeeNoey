import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { siteConfig } from "@/config/site";
import { FOOTER_NAV, RISK_DISCLAIMER } from "@/config/marketing";
import { BrandMark } from "./site-header";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-white/10 bg-[#0D121C] text-sm text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <BrandMark />
          <p className="max-w-sm leading-relaxed">{siteConfig.description}</p>
        </div>

        {FOOTER_NAV.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h2 className="text-sm font-semibold text-gray-300">{group.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-amber-400 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-3">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-gray-400">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-500/70" aria-hidden="true" />
            <span>{RISK_DISCLAIMER}</span>
          </p>
          <p className="text-xs text-gray-400">
            © {year} {siteConfig.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
