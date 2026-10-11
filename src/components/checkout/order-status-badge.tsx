import { ORDER_PHASE_LABELS, type BadgeTone } from "@/lib/orders/messages";
import type { OrderPhase } from "@/lib/orders/phase";

const TONE_CLASSES: Record<BadgeTone, string> = {
  amber: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  blue: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  red: "bg-red-500/10 text-red-300 border-red-500/30",
  gray: "bg-white/5 text-gray-300 border-white/10",
};

export function OrderStatusBadge({ phase }: { phase: OrderPhase }) {
  const { label, tone } = ORDER_PHASE_LABELS[phase];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>{label}</span>;
}
