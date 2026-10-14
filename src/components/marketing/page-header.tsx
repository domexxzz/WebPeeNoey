import { loadDelayStyle as loadDelay } from "@/lib/motion";
import { Phrases } from "./phrases";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}

/** หัวหน้าเพจย่อย — อยู่บนสุดของหน้าจึงเล่นทันทีตอนโหลด (ไม่รอเลื่อน) */
export function PageHeader({ eyebrow, title, description, children }: PageHeaderProps) {
  return (
    <header className="border-b border-line">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="px-4 sm:px-6 lg:px-10 py-14 sm:py-20 lg:border-r lg:border-line">
          <p className="mx-load inline-flex items-center gap-2 border border-line px-3 py-1 text-xs font-semibold tracking-wide text-gold-ink rounded-full">
            <span aria-hidden="true" className="mx-ping w-1.5 h-1.5 bg-gold rounded-full" />
            {eyebrow}
          </p>
          <h1 className="mx-load-words mt-6 max-w-4xl font-display text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05] text-fg" style={loadDelay(120)}>
            <Phrases text={title} animate />
          </h1>
          <p className="mx-load mt-6 max-w-2xl text-base sm:text-lg text-fg-muted leading-relaxed" style={loadDelay(450)}>
            {description}
          </p>
          {children}
        </div>
        <div aria-hidden="true" data-loop="" className="hidden lg:flex items-end justify-end p-10">
          <span className="mx-float block w-16 h-16 bg-gold rounded-xl" />
        </div>
      </div>
    </header>
  );
}
