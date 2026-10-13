interface AccountPageHeaderProps {
  eyebrow: string;
  title: string;
  description: React.ReactNode;
  children?: React.ReactNode;
}

/** หัวหน้าในโซนสมาชิก/ชำระเงิน — สไตล์เดียวกับหน้าบ้าน (ป้ายกรอบเส้น + หัวข้อหนาใหญ่) */
export function AccountPageHeader({ eyebrow, title, description, children }: AccountPageHeaderProps) {
  return (
    <header className="flex flex-col items-start gap-6 border-b border-line pb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="inline-flex items-center gap-2 border border-line px-3 py-1 text-xs font-semibold tracking-wide text-signal rounded-full">
          <span aria-hidden="true" className="w-1.5 h-1.5 bg-signal rounded-full" />
          {eyebrow}
        </p>
        <h1 className="mt-5 font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05] text-white">{title}</h1>
        <p className="mt-3 max-w-2xl text-base text-gray-300 leading-relaxed">{description}</p>
      </div>
      {children}
    </header>
  );
}
