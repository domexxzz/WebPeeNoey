import { ArrowUpRight, MessagesSquare } from "lucide-react";
import { COMMUNITY } from "@/config/community";

/** แถบชวนเข้าคอมมูนิตี้ Discord (หน้าแรก ใต้ช่องทางติดต่อ) — ไม่แสดงจำนวนสมาชิก; ลิงก์ไม่ถูกต้อง = ไม่แสดงเลย */
export function CommunityBand({ inviteUrl }: { inviteUrl: string | null }) {
  if (!inviteUrl) return null;
  const { name, eyebrow, title, description, joinLabel } = COMMUNITY.discord;
  return (
    <div
      data-reveal="up"
      className="mt-10 flex flex-col gap-6 border border-gold bg-gold-muted p-7 sm:p-10 rounded-2xl md:flex-row md:items-center md:justify-between"
    >
      <div className="flex items-start gap-5">
        <span aria-hidden="true" className="flex w-14 h-14 shrink-0 items-center justify-center bg-gold text-fg rounded-2xl">
          <MessagesSquare className="w-7 h-7" />
        </span>
        <div>
          <p className="text-sm font-semibold text-gold-ink">
            {eyebrow} · {name}
          </p>
          <h3 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-fg">{title}</h3>
          <p className="mt-2 max-w-2xl text-sm sm:text-base leading-relaxed text-fg-muted">{description}</p>
        </div>
      </div>
      <a
        href={inviteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mx-shine group inline-flex shrink-0 items-center justify-center gap-2 bg-fg px-6 py-3.5 text-sm font-semibold text-page transition-colors hover:bg-fg/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-ink rounded-xl"
      >
        {joinLabel}
        <ArrowUpRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
        <span className="sr-only">(เปิดในแท็บใหม่)</span>
      </a>
    </div>
  );
}
