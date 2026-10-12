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

export function SectionHeading({ id, eyebrow, title, description, align = "left", tone = "dark" }: SectionHeadingProps) {
  const alignment = align === "center" ? "text-center mx-auto items-center" : "items-start";
  const onSignal = tone === "signal";
  return (
    <div className={`flex flex-col max-w-3xl ${alignment}`}>
      <p
        className={`inline-flex items-center gap-2 border px-3 py-1 text-xs font-semibold tracking-wide ${
          onSignal ? "border-ink/70 text-ink" : "border-line text-signal"
        }`}
      >
        <span aria-hidden="true" className={`w-1.5 h-1.5 ${onSignal ? "bg-ink" : "bg-signal"}`} />
        {eyebrow}
      </p>
      <h2
        id={id}
        className={`mt-5 font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] ${
          onSignal ? "text-ink" : "text-white"
        }`}
      >
        <Phrases text={title} />
      </h2>
      {description && (
        <p className={`mt-5 text-base sm:text-lg leading-relaxed ${onSignal ? "text-ink/80" : "text-gray-300"}`}>{description}</p>
      )}
    </div>
  );
}
