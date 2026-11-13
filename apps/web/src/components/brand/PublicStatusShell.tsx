import type { ReactNode } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';

export function PublicStatusShell({
  eyebrow,
  title,
  description,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8f6f1] px-5 py-12 text-resort-900 sm:px-8">
      <div className="absolute inset-x-0 top-0 h-2 bg-lime-400" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border border-resort-900/10" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full border border-lime-500/25" />

      <section className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-black/5 bg-white shadow-[0_28px_90px_rgba(14,34,60,0.12)]">
        <div className="bg-resort-900 px-7 pb-10 pt-7 text-white sm:px-10">
          <Link href="/" aria-label="ResortPro home" className="inline-flex">
            <BrandLogo inverse />
          </Link>
          <div className="mt-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-300 text-resort-900">
            {icon}
          </div>
          <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.18em] text-lime-300">{eyebrow}</p>
          <h1 className="mt-3 font-editorial text-[clamp(2.35rem,8vw,3.8rem)] font-medium leading-[0.98] tracking-[-0.035em]">
            {title}
          </h1>
          {description && <p className="mt-4 max-w-md text-sm leading-6 text-white/65">{description}</p>}
        </div>
        <div className="px-7 py-8 sm:px-10 sm:py-10">{children}</div>
      </section>
    </main>
  );
}

export const publicFieldClass =
  'h-12 rounded-xl border-[#d9d7d1] bg-[#fbfaf7] px-4 text-resort-900 shadow-none placeholder:text-slate-400 focus-visible:border-lime-600 focus-visible:ring-lime-600/20';

export const publicPrimaryButtonClass =
  'h-12 w-full rounded-full bg-lime-400 font-extrabold text-resort-900 shadow-none hover:bg-lime-300';
