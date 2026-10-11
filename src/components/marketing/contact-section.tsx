import { Mail, MessageCircle, Send, type LucideIcon } from "lucide-react";
import { siteConfig } from "@/config/site";
import { HOME_SECTION_IDS } from "@/config/marketing";
import { SectionHeading } from "./section-heading";

interface ContactChannel {
  label: string;
  value: string;
  href: string;
  icon: LucideIcon;
}

function toLineUrl(lineId: string): string {
  return `https://line.me/R/ti/p/${encodeURIComponent(lineId)}`;
}

function toTelegramUrl(handle: string): string {
  return `https://t.me/${handle.replace(/^@/, "")}`;
}

export function getContactChannels(): ContactChannel[] {
  const { email, line, telegram } = siteConfig.contact;
  return [
    { label: "อีเมล", value: email, href: `mailto:${email}`, icon: Mail },
    { label: "LINE Official", value: line, href: toLineUrl(line), icon: MessageCircle },
    { label: "Telegram", value: telegram, href: toTelegramUrl(telegram), icon: Send },
  ];
}

export function ContactSection() {
  return (
    <section aria-labelledby={`${HOME_SECTION_IDS.contact}-heading`} id={HOME_SECTION_IDS.contact} className="scroll-mt-20 py-20 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl glass-panel-gold p-8 sm:p-12 grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <SectionHeading
            id={`${HOME_SECTION_IDS.contact}-heading`}
            eyebrow="ติดต่อเรา"
            title="มีคำถาม ติดต่อทีมงานได้โดยตรง"
            description="แจ้งอีเมลที่ใช้สมัครและหมายเลขคำสั่งซื้อ (ถ้ามี) เพื่อให้ทีมงานตรวจสอบได้รวดเร็วขึ้น"
          />

          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {getContactChannels().map((channel) => {
              const Icon = channel.icon;
              const isExternal = channel.href.startsWith("http");
              return (
                <li key={channel.label}>
                  <a
                    href={channel.href}
                    {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 px-5 py-4 hover:border-amber-500/40 hover:bg-black/30 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                  >
                    <span className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs text-gray-400">{channel.label}</span>
                      <span className="block text-sm font-medium text-white truncate">{channel.value}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
