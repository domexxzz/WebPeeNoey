import Link from "next/link";
import { ArrowRight, ArrowUpRight, Handshake, Mail, MessageCircle, Send, Users, type LucideIcon } from "lucide-react";
import { siteConfig, type ContactInfo } from "@/config/site";
import { HOME_SECTION_IDS, RISK_DISCLAIMER } from "@/config/marketing";
import { COMMUNITY } from "@/config/community";
import { staggerStyle } from "@/lib/motion";

interface ProfileLink {
  label: string;
  hint: string;
  href: string;
  icon: LucideIcon;
  external: boolean;
}

interface ContactProfileProps {
  contact?: ContactInfo;
  facebook?: string | null;
  discordInvite?: string | null;
}

const toLineUrl = (lineId: string) => `https://line.me/R/ti/p/${encodeURIComponent(lineId)}`;
const toTelegramUrl = (handle: string) => `https://t.me/${handle.replace(/^@/, "")}`;

/**
 * ลิงก์ที่แสดงบนหน้าโปรไฟล์ — เฉพาะช่องทางที่ตั้งค่าไว้จริง
 * ช่องทางที่ไม่ได้ตั้งจะหายไปทั้งปุ่ม ไม่แสดงปุ่มที่กดแล้วไปไหนไม่ได้
 */
export function getProfileLinks({ contact, facebook, discordInvite }: Required<ContactProfileProps>): ProfileLink[] {
  const links: ProfileLink[] = [];
  if (contact.line) {
    links.push({ label: "LINE Official", hint: contact.line, href: toLineUrl(contact.line), icon: MessageCircle, external: true });
  }
  if (contact.telegram) {
    links.push({ label: "Telegram", hint: contact.telegram, href: toTelegramUrl(contact.telegram), icon: Send, external: true });
  }
  if (discordInvite) {
    links.push({ label: COMMUNITY.discord.joinLabel, hint: COMMUNITY.discord.name, href: discordInvite, icon: Users, external: true });
  }
  if (facebook) {
    links.push({ label: "Facebook", hint: "เพจอย่างเป็นทางการ", href: facebook, icon: ArrowUpRight, external: true });
  }
  if (contact.email) {
    links.push({ label: "อีเมล", hint: contact.email, href: `mailto:${contact.email}`, icon: Mail, external: false });
  }
  return links;
}

/**
 * หน้าโปรไฟล์รวมช่องทางติดต่อ — ลิงก์เดียวที่เอาไปแปะในไบโอโซเชียลได้
 * ปุ่มสิทธิ์ฟรีผ่านโบรกเกอร์ต้องพาไปหน้า /broker-ib ซึ่งมีเงื่อนไขและข้อความเปิดเผยค่าตอบแทนครบ
 * ห้ามยิงลิงก์พาร์ทเนอร์ของโบรกเกอร์ออกไปตรง ๆ จากหน้านี้
 */
export function ContactProfile({
  contact = siteConfig.contact,
  facebook = siteConfig.contact.facebook ?? null,
  discordInvite = COMMUNITY.discord.inviteUrl,
}: ContactProfileProps) {
  const links = getProfileLinks({ contact, facebook, discordInvite });

  return (
    <div className="mx-auto w-full max-w-xl px-4 sm:px-6 py-14 sm:py-20">
      <div data-reveal="up" className="flex flex-col items-center text-center">
        <span aria-hidden="true" className="flex w-16 h-16 items-center justify-center border border-gold bg-gold/10 font-display text-2xl font-bold text-gold-ink rounded-2xl">
          GH
        </span>
        <h1 className="mt-5 font-display text-3xl sm:text-4xl font-bold tracking-tight text-fg">{siteConfig.name}</h1>
        <p className="mt-3 text-sm sm:text-base text-fg-muted leading-relaxed">
          อินดิเคเตอร์ทองคำบน TradingView พร้อมกลุ่มแจ้งเตือนและคอมมูนิตี้ — ทักมาถามก่อนสมัครได้ทุกช่องทาง
        </p>
      </div>

      {links.length > 0 ? (
        <ul className="mt-9 flex flex-col gap-3">
          {links.map((link, index) => {
            const Icon = link.icon;
            return (
              <li key={link.label} data-reveal="up" style={staggerStyle(index, 90)}>
                <a
                  href={link.href}
                  {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group flex items-center gap-4 border border-line bg-surface px-5 py-4 transition-colors hover:border-gold focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-ink rounded-2xl"
                >
                  <span className="flex w-10 h-10 shrink-0 items-center justify-center border border-line text-gold-ink transition-colors group-hover:bg-gold group-hover:text-fg group-hover:border-gold rounded-xl">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-semibold text-fg">{link.label}</span>
                    <span className="block truncate text-xs text-fg-subtle">{link.hint}</span>
                  </span>
                  <ArrowUpRight className="w-4 h-4 shrink-0 text-fg-subtle transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-gold-ink" aria-hidden="true" />
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-9 border border-line bg-surface px-5 py-4 text-sm text-fg-subtle rounded-2xl">
          ยังไม่ได้ตั้งค่าช่องทางติดต่อ — ตั้งค่าได้ในระบบโฮสต์
        </p>
      )}

      <div className="mt-9 grid gap-3 sm:grid-cols-2">
        <Link
          href={`/#${HOME_SECTION_IDS.pricing}`}
          className="group flex items-center justify-center gap-2 bg-gold px-5 py-3.5 text-sm font-semibold text-fg transition-colors hover:bg-gold-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-ink rounded-xl"
        >
          ดูแพ็กเกจและราคา
          <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
        </Link>
        <Link
          href="/broker-ib"
          className="flex items-center justify-center gap-2 border border-line bg-surface px-5 py-3.5 text-sm font-semibold text-fg transition-colors hover:border-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-ink rounded-xl"
        >
          <Handshake className="w-4 h-4 text-gold-ink" aria-hidden="true" />
          ใช้ฟรีผ่านโบรกเกอร์
        </Link>
      </div>

      <p className="mt-9 border-t border-line pt-6 text-xs text-fg-subtle leading-relaxed">{RISK_DISCLAIMER}</p>
    </div>
  );
}
