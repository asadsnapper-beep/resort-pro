import type { ReactNode } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';

type MarketingAuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  children: ReactNode;
};

export function MarketingAuthShell({ eyebrow, title, description, points, children }: MarketingAuthShellProps) {
  return (
    <div className="min-h-screen bg-[#f8f6f1] font-sans text-resort-900 lg:grid lg:grid-cols-[0.88fr_1.12fr]">
      <aside className="relative hidden min-h-screen overflow-hidden bg-resort-900 p-12 text-white lg:flex lg:flex-col xl:p-16">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-lime-300/20" />
        <div className="absolute -right-8 -top-8 h-48 w-48 rounded-full border border-lime-300/20" />
        <Link href="/" className="relative z-10 inline-flex w-fit" aria-label="ResortPro home">
          <BrandLogo inverse />
        </Link>

        <div className="relative z-10 my-auto max-w-xl py-16">
          <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-lime-300">{eyebrow}</span>
          <h2 className="font-editorial mt-5 text-[clamp(3rem,5vw,5.3rem)] font-medium leading-[0.98] tracking-[-0.035em]">
            {title}
          </h2>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/65">{description}</p>
          <ul className="mt-10 space-y-4">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-3 text-sm font-bold text-white/80">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lime-300 text-resort-900">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/40">Built for independent resorts and their teams.</p>
      </aside>

      <main className="relative flex min-h-screen items-center justify-center px-5 py-16 sm:px-8 lg:px-12">
        {children}
      </main>
    </div>
  );
}
