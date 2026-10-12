import { ORDER_PHASE_LABELS, type BadgeTone } from "@/lib/orders/messages";
import type { OrderPhase } from "@/lib/orders/phase";

/** สีตามความหมาย: เขียวสัญญาณ = สำเร็จ, อำพัน = รอดำเนินการ, ฟ้า = รอชำระ, แดง = ไม่ผ่าน, เทา = จบแล้ว */
const TONE_CLASSES: Record<BadgeTone, string> = {
  amber: "border-amber-400/60 text-amber-300",
  blue: "border-sky-400/60 text-sky-300",
  emerald: "border-signal bg-signal text-ink",
  red: "border-red-400/60 text-red-300",
  gray: "border-line-soft text-gray-400",
};

export function OrderStatusBadge({ phase }: { phase: OrderPhase }) {
  const { label, tone } = ORDER_PHASE_LABELS[phase];
  return <span className={`inline-flex items-center whitespace-nowrap border px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[tone]}`}>{label}</span>;
}
