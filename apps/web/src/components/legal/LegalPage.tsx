import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/brand/BrandLogo';

// Palette matches the landing page's design system
// (claude.ai/design/p/d56b55b0-882c-44d6-aecd-3667a5499d43 — "ResortPro Landing.dc.html").
// Keep these in sync with LandingPage.tsx if that source changes.
const NAVY = '#0e223c';
const LIME = '#65a30d';
const CREAM = '#f8f6f1';
const BORDER = '#e7e5df';
const MUTED = '#586574';

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
    <div className="min-h-screen bg-[#f8f6f1] font-sans" style={{ color: NAVY }}>
      {/* Header */}
      <header className="border-b bg-[#f8f6f1]/95 backdrop-blur" style={{ borderColor: BORDER }}>
        <div className="mx-auto flex min-h-[72px] max-w-[900px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center" aria-label="ResortPro home">
            <BrandLogo />
          </Link>
          <Link href="/" className="rounded-full border border-resort-900/15 px-4 py-2 text-sm font-extrabold transition-colors hover:bg-white">
            ← Back to home
          </Link>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-[760px] px-5 py-16 sm:px-8 sm:py-24">
        <span
          className="block text-[12px] font-extrabold uppercase tracking-[0.18em]"
          style={{ color: LIME }}
        >
          Legal
        </span>
        <h1 className="mt-4 font-editorial text-[clamp(2.75rem,7vw,5rem)] font-medium leading-[0.98] tracking-[-0.035em]">
          {title}
        </h1>
        <p className="mt-4 text-sm font-semibold" style={{ color: MUTED }}>Last updated: {updated}</p>

        <div className="legal-prose mt-10">{children}</div>

        <div className="mt-16 rounded-[1.75rem] border p-7" style={{ background: '#ffffff', borderColor: BORDER }}>
          <p className="text-[15px] leading-[1.7]">
            Questions about this page? Email{' '}
            <a href="mailto:support@resortpro.site" className="font-bold underline decoration-2 underline-offset-4" style={{ color: LIME }}>
              support@resortpro.site
            </a>
            .
          </p>
        </div>
      </main>

      {/* Footer — matches apps/web/src/components/landing/LandingPage.tsx */}
      <footer style={{ background: NAVY }} className="text-white">
        <div className="mx-auto flex max-w-[900px] flex-col items-center gap-6 px-5 py-10 sm:flex-row sm:justify-between sm:px-8">
          <Link href="/" className="flex items-center">
            <BrandLogo inverse />
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-semibold">
            <Link href="/terms" className="transition-colors hover:opacity-70" style={{ color: '#bef264' }}>Terms</Link>
            <Link href="/privacy" className="transition-colors hover:opacity-70" style={{ color: '#bef264' }}>Privacy</Link>
            <Link href="/refund" className="transition-colors hover:opacity-70" style={{ color: '#bef264' }}>Refund</Link>
          </div>
        </div>
        <div className="border-t px-5 py-6 text-center text-xs text-white/55 sm:px-8" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
          © {new Date().getFullYear()} ResortPro.
        </div>
      </footer>
    </div>
  );
}

/** Small typographic helpers so pages read cleanly without a prose plugin. */
export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 mt-11 font-editorial text-[1.65rem] font-medium" style={{ color: NAVY }}>{children}</h2>;
}
export function P({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-[15px] leading-[1.75]" style={{ color: MUTED }}>{children}</p>;
}
export function UL({ children }: { children: ReactNode }) {
  return <ul className="mb-4 ml-5 list-disc space-y-2 text-[15px] leading-[1.7]" style={{ color: MUTED }}>{children}</ul>;
}
