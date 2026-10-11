import { Phrases } from "./phrases";

interface SectionHeadingProps {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}

export function SectionHeading({ id, eyebrow, title, description, align = "left" }: SectionHeadingProps) {
  const alignment = align === "center" ? "text-center mx-auto" : "";
  return (
    <div className={`max-w-2xl ${alignment}`}>
      <p className="text-sm font-semibold text-amber-400">{eyebrow}</p>
      <h2 id={id} className="mt-3 font-heading text-3xl sm:text-4xl font-bold text-white leading-tight">
        <Phrases text={title} />
      </h2>
      {description && <p className="mt-3 text-sm sm:text-base text-gray-400 leading-relaxed">{description}</p>}
    </div>
  );
}
