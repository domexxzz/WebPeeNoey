import { Phrases } from "./phrases";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, description, children }: PageHeaderProps) {
  return (
    <header className="border-b border-line">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="px-4 sm:px-6 lg:px-10 py-14 sm:py-20 lg:border-r lg:border-line">
          <p className="inline-flex items-center gap-2 border border-line px-3 py-1 text-xs font-semibold tracking-wide text-signal">
            <span aria-hidden="true" className="w-1.5 h-1.5 bg-signal" />
            {eyebrow}
          </p>
          <h1 className="mt-6 max-w-4xl font-display text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05] text-white">
            <Phrases text={title} />
          </h1>
          <p className="mt-6 max-w-2xl text-base sm:text-lg text-gray-300 leading-relaxed">{description}</p>
          {children}
        </div>
        <div aria-hidden="true" className="hidden lg:flex items-end justify-end p-10">
          <span className="block w-16 h-16 bg-signal" />
        </div>
      </div>
    </header>
  );
}
