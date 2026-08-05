import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Shared shell for legal pages (Terms, Privacy, Refund).
 * Server component — good for SEO and fast static render.
 *
 * Matches the landing page's design system exactly: navy #183153 / coral
 * #ef725c / cream #fff1ea, bold extrabold type, thick 2px borders, zero
 * corner radius. See apps/web/src/app/page.tsx for the source of truth.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#fff1ea] text-[#183153]">
      {/* Header */}
      <header className="border-b-2 border-[#183153] bg-white">
        <div className="mx-auto flex min-h-[74px] max-w-[900px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="ResortPro home">
            <span className="relative block h-7 w-7 overflow-hidden bg-[#fff]">
              <Image
                src="/brand/resortpro-icon-mark.png"
                alt="ResortPro"
                fill
                sizes="28px"
                className="object-cover"
              />
            </span>
            <span className="text-lg font-extrabold tracking-[-0.04em]">ResortPro</span>
          </Link>
          <Link href="/" className="text-sm font-bold hover:text-[#ef725c]">
            ← Back to home
          </Link>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-[760px] px-5 py-14 sm:px-8">
        <p className="font-bitcount m-0 text-[11px] font-medium uppercase tracking-[0.18em] text-[#b2402c]">
          Legal
        </p>
        <h1 className="mt-3 max-w-[620px] text-[clamp(2.2rem,4.5vw,3.4rem)] font-extrabold leading-[.98] tracking-[-0.05em] text-[#183153]">
          {title}
        </h1>
        <p className="mt-4 text-sm font-semibold text-[#64748b]">Last updated: {updated}</p>

        <div className="legal-prose mt-10">{children}</div>

        <div className="mt-16 border-2 border-[#183153] bg-white p-6">
          <p className="text-[15px] leading-[1.7] text-[#183153]">
            Questions about this page? Email{' '}
            <a href="mailto:support@resortpro.site" className="font-bold text-[#ef725c] underline">
              support@resortpro.site
            </a>
            .
          </p>
        </div>
      </main>

      {/* Footer — matches apps/web/src/app/page.tsx exactly */}
      <footer className="bg-[#183153] text-white">
        <div className="mx-auto flex max-w-[900px] flex-col justify-between gap-8 px-5 py-12 sm:flex-row sm:items-end sm:px-8">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="relative block h-7 w-7 overflow-hidden bg-white">
                <Image
                  src="/brand/resortpro-icon-mark.png"
                  alt="ResortPro"
                  fill
                  sizes="28px"
                  className="object-cover"
                />
              </span>
              <span className="text-lg font-extrabold tracking-[-0.04em]">ResortPro</span>
            </div>
            <p className="mt-4 max-w-[330px] text-sm leading-6 text-white/70">
              The operating system for resorts that want every stay to feel personal.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-7 gap-y-3 text-sm font-bold text-white/85">
            <Link href="/terms" className="hover:text-[#f4c76b]">Terms</Link>
            <Link href="/privacy" className="hover:text-[#f4c76b]">Privacy</Link>
            <Link href="/refund" className="hover:text-[#f4c76b]">Refund</Link>
          </div>
        </div>
        <div className="mx-auto max-w-[900px] border-t border-white/25 px-5 py-6 text-xs text-white/55 sm:px-8">
          © {new Date().getFullYear()} ResortPro.
        </div>
      </footer>
    </div>
  );
}

/** Small typographic helpers so pages read cleanly without a prose plugin. */
export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 mb-3 text-[1.4rem] font-extrabold tracking-[-0.02em] text-[#183153]">{children}</h2>;
}
export function P({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-[15px] leading-[1.75] text-[#3f4a47]">{children}</p>;
}
export function UL({ children }: { children: ReactNode }) {
  return <ul className="mb-4 ml-5 list-disc space-y-2 text-[15px] leading-[1.7] text-[#3f4a47]">{children}</ul>;
}
