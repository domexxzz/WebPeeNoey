import { Phrases } from "./phrases";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, description, children }: PageHeaderProps) {
  return (
    <header className="relative overflow-hidden border-b border-white/5">
      <div aria-hidden="true" className="absolute -top-24 right-0 w-[480px] h-[320px] bg-amber-500/10 blur-[120px]" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <p className="text-sm font-semibold text-amber-400">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl font-heading text-3xl sm:text-5xl font-bold text-white leading-tight">
          <Phrases text={title} />
        </h1>
        <p className="mt-4 max-w-2xl text-base sm:text-lg text-gray-300 leading-relaxed">{description}</p>
        {children}
      </div>
    </header>
  );
}
