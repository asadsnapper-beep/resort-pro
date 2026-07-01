import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Shared shell for legal pages (Terms, Privacy, Refund).
 * Server component — good for SEO and fast static render.
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
    <div className="min-h-screen bg-[#faf8f3] text-[#1b342f]">
      {/* Header */}
      <header className="border-b border-[rgba(25,64,59,0.08)] bg-[#faf8f3]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[900px] items-center justify-between px-7 py-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-resort-900 text-sm font-bold text-gold-500">R</span>
            <span className="font-display text-lg font-semibold text-resort-900">ResortPro</span>
          </Link>
          <Link href="/" className="text-sm font-medium text-[#3f4a47] transition-colors hover:text-resort-600">
            ← Back to home
          </Link>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-[760px] px-7 py-14">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a918d]">Legal</p>
        <h1 className="font-display text-[clamp(2rem,4vw,2.8rem)] font-medium leading-[1.1] tracking-[-0.02em] text-resort-900">
          {title}
        </h1>
        <p className="mt-4 text-sm text-[#8a918d]">Last updated: {updated}</p>

        <div className="legal-prose mt-10">{children}</div>

        <div className="mt-16 rounded-2xl border border-[rgba(25,64,59,0.1)] bg-white p-6">
          <p className="text-sm leading-[1.7] text-[#3f4a47]">
            Questions about this page? Email{' '}
            <a href="mailto:support@resortpro.site" className="font-medium text-resort-600 underline">
              support@resortpro.site
            </a>
            .
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[rgba(25,64,59,0.08)] py-8">
        <div className="mx-auto flex max-w-[760px] flex-wrap items-center justify-between gap-3 px-7">
          <span className="text-[13px] text-[#8a918d]">© {new Date().getFullYear()} ResortPro. Made in Bangladesh.</span>
          <div className="flex gap-5 text-[13px] text-[#8a918d]">
            <Link href="/terms" className="hover:text-resort-600">Terms</Link>
            <Link href="/privacy" className="hover:text-resort-600">Privacy</Link>
            <Link href="/refund" className="hover:text-resort-600">Refund</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Small typographic helpers so pages read cleanly without a prose plugin. */
export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 mb-3 font-display text-[1.35rem] font-semibold text-resort-900">{children}</h2>;
}
export function P({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-[15px] leading-[1.75] text-[#3f4a47]">{children}</p>;
}
export function UL({ children }: { children: ReactNode }) {
  return <ul className="mb-4 ml-5 list-disc space-y-2 text-[15px] leading-[1.7] text-[#3f4a47]">{children}</ul>;
}
