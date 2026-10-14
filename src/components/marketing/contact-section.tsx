import Link from "next/link";
import { ArrowRight, ArrowUpRight, Mail, MessageCircle, Send, type LucideIcon } from "lucide-react";
import { siteConfig } from "@/config/site";
import { HOME_SECTION_IDS } from "@/config/marketing";
import { staggerStyle } from "@/lib/motion";
import { HeroChart } from "./hero-chart";
import { Phrases } from "./phrases";

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

/** ปิดท้ายหน้า: ภาพกราฟขนาดใหญ่ + กล่องดำซ้อนทับ (เรียกให้เริ่มใช้งาน) แล้วตามด้วยช่องทางติดต่อ */
export function ContactSection() {
  return (
    <section aria-labelledby={`${HOME_SECTION_IDS.contact}-heading`} id={HOME_SECTION_IDS.contact} className="scroll-mt-20">
      <div className="px-4 sm:px-6 lg:px-10 py-20 sm:py-28">
        <div className="relative">
          <div data-reveal="zoom" data-loop="" className="border border-line bg-surface p-3 sm:p-6 lg:pl-[38%] rounded-2xl">
            <HeroChart animated className="w-full h-auto opacity-90" />
          </div>
          <div
            data-reveal="up"
            style={staggerStyle(3, 120)}
            className="relative -mt-16 mx-3 sm:mx-8 lg:absolute lg:bottom-10 lg:left-10 lg:mt-0 lg:mx-0 lg:w-[42%] border border-line bg-surface p-7 sm:p-10 shadow-[0_30px_80px_-30px_rgba(31,26,18,0.22)] rounded-2xl"
          >
            <p className="text-sm font-semibold text-gold-ink">ติดต่อเรา</p>
            <h2
              id={`${HOME_SECTION_IDS.contact}-heading`}
              data-reveal="words"
              style={staggerStyle(5, 120)}
              className="mt-3 font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05] text-fg"
            >
              <Phrases text="มีคำถาม ติดต่อทีมงานได้โดยตรง" animate />
            </h2>
            <p className="mt-4 text-sm sm:text-base text-fg-muted leading-relaxed">
              แจ้งอีเมลที่ใช้สมัครและหมายเลขคำสั่งซื้อ (ถ้ามี) เพื่อให้ทีมงานตรวจสอบได้รวดเร็วขึ้น
            </p>
            <Link
              href={`/#${HOME_SECTION_IDS.pricing}`}
              data-magnetic=""
              className="mx-shine group mt-7 inline-flex items-center gap-2 bg-gold px-6 py-3.5 text-sm font-semibold text-fg hover:bg-gold-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-ink rounded-xl"
            >
              พร้อมเริ่มแล้ว — ดูแพ็กเกจ
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <ul className="mt-10 grid gap-px bg-line border border-line sm:grid-cols-3 rounded-2xl overflow-hidden">
          {getContactChannels().map((channel, index) => {
            const Icon = channel.icon;
            const isExternal = channel.href.startsWith("http");
            return (
              <li key={channel.label} data-spotlight="" data-reveal="up" style={staggerStyle(index, 110)} className="bg-surface">
                <a
                  href={channel.href}
                  {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group flex items-center gap-4 px-6 py-6 transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-ink"
                >
                  <span className="flex w-11 h-11 shrink-0 items-center justify-center border border-line text-gold-ink transition-[transform,background-color,color,border-color] duration-500 group-hover:rotate-[-8deg] group-hover:scale-110 group-hover:bg-gold group-hover:text-fg group-hover:border-gold rounded-xl">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-fg-subtle">{channel.label}</span>
                    <span className="block truncate text-base font-medium text-fg">{channel.value}</span>
                  </span>
                  <ArrowUpRight className="w-4 h-4 shrink-0 text-fg-subtle transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-gold-ink" aria-hidden="true" />
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
