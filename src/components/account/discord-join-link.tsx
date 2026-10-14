import { ArrowUpRight } from "lucide-react";
import { COMMUNITY } from "@/config/community";

/** ในแดชบอร์ดสมาชิก: ลิงก์เข้าเซิร์ฟเวอร์ Discord + วิธีรับยศ VIP (ทีมงานให้ยศด้วยมือ) */
export function DiscordJoinLink({ inviteUrl }: { inviteUrl: string | null }) {
  if (!inviteUrl) return null;
  return (
    <span className="flex flex-col items-end gap-0.5 text-right">
      <a href={inviteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold text-gold-ink hover:text-gold-ink">
        เข้าร่วมเซิร์ฟเวอร์ <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="sr-only">(เปิดในแท็บใหม่)</span>
      </a>
      <span className="text-[11px] leading-snug text-fg-subtle">{COMMUNITY.discord.vipHint}</span>
    </span>
  );
}
