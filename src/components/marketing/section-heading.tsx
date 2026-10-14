import { staggerStyle } from "@/lib/motion";
import { Phrases } from "./phrases";

interface SectionHeadingProps {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  /** dark = พื้นดำ (ค่าเริ่มต้น), signal = วางบนพื้นเขียว */
  tone?: "dark" | "signal";
}

/** หัวข้อส่วน: ป้ายเปิดออกจากซ้าย → หัวข้อลอยขึ้นทีละวลี → คำอธิบายตามมา (เมื่อเลื่อนมาถึง) */
export function SectionHeading({ id, eyebrow, title, description, align = "left", tone = "dark" }: SectionHeadingProps) {
  const alignment = align === "center" ? "text-center mx-auto items-center" : "items-start";
  const onSignal = tone === "signal";
  return (
    <div className={`flex flex-col max-w-3xl ${alignment}`}>
      <p
        data-reveal="clip"
        className={`inline-flex items-center gap-2 border px-3 py-1 text-xs font-semibold tracking-wide rounded-full ${
          onSignal ? "border-fg/70 text-fg" : "border-line text-gold-ink"
        }`}
      >
        <span aria-hidden="true" className={`w-1.5 h-1.5 ${onSignal ? "bg-surface" : "bg-gold"}`} />
        {eyebrow}
      </p>
      <h2
        id={id}
        data-reveal="words"
        style={staggerStyle(2, 90)}
        className={`mt-5 font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] ${
          onSignal ? "text-fg" : "text-fg"
        }`}
      >
        <Phrases text={title} animate />
      </h2>
      {description && (
        <p
          data-reveal="up"
          style={staggerStyle(5, 90)}
          className={`mt-5 text-base sm:text-lg leading-relaxed ${onSignal ? "text-fg/80" : "text-fg-muted"}`}
        >
          {description}
        </p>
      )}
    </div>
  );
}
