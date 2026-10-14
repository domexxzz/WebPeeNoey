import { ORDER_PHASE_LABELS, type BadgeTone } from "@/lib/orders/messages";
import type { OrderPhase } from "@/lib/orders/phase";

/** สีตามความหมาย (ธีมครีม-ทอง): เขียว = สำเร็จ, ส้ม = รอดำเนินการ, ฟ้า = รอชำระ, แดง = ไม่ผ่าน, เทา = จบแล้ว — ทองสงวนไว้สำหรับแบรนด์/ปุ่ม ไม่ใช้เป็นสถานะ */
const TONE_CLASSES: Record<BadgeTone, string> = {
  amber: "border-orange-500/50 text-orange-700",
  blue: "border-sky-500/50 text-sky-700",
  emerald: "border-emerald-600/40 bg-emerald-50 text-emerald-800",
  red: "border-red-500/40 text-red-700",
  gray: "border-line-soft text-fg-subtle",
};

export function OrderStatusBadge({ phase }: { phase: OrderPhase }) {
  const { label, tone } = ORDER_PHASE_LABELS[phase];
  return <span className={`inline-flex items-center whitespace-nowrap border px-2.5 py-1 text-xs font-semibold rounded-full ${TONE_CLASSES[tone]}`}>{label}</span>;
}
