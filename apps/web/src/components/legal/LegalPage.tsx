import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

// Palette matches the landing page's design system
// (claude.ai/design/p/d56b55b0-882c-44d6-aecd-3667a5499d43 — "ResortPro Landing.dc.html").
// Keep these in sync with LandingPage.tsx if that source changes.
const NAVY = '#14314D';
const GOLD = '#CFA153';
const CREAM = '#F7F3EE';
const BORDER = '#EDE7DD';
const MUTED = '#5B6B79';

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
    <div className="min-h-screen bg-white font-sans" style={{ color: NAVY }}>
      {/* Header */}
      <header className="border-b bg-white" style={{ borderColor: BORDER }}>
        <div className="mx-auto flex min-h-[72px] max-w-[900px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="ResortPro home">
            <span
              className="relative flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-lg"
              style={{ background: NAVY }}
            >
              <Image
                src="/brand/resortpro-icon-mark.png"
                alt="ResortPro"
                fill
                sizes="36px"
                className="scale-125 object-cover mix-blend-screen"
              />
            </span>
            <span className="text-lg font-extrabold">ResortPro</span>
          </Link>
          <Link href="/" className="text-sm font-semibold transition-colors hover:opacity-70">
            ← Back to home
          </Link>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-[760px] px-5 py-14 sm:px-8">
        <span
          className="font-bitcount block text-[13px] font-medium uppercase tracking-[0.14em]"
          style={{ color: GOLD }}
        >
          Legal
        </span>
        <h1 className="mt-3 text-[clamp(2rem,4vw,2.8rem)] font-extrabold leading-[1.15]">
          {title}
        </h1>
        <p className="mt-4 text-sm font-semibold" style={{ color: MUTED }}>Last updated: {updated}</p>

        <div className="legal-prose mt-10">{children}</div>

        <div className="mt-16 rounded-2xl p-6" style={{ background: CREAM }}>
          <p className="text-[15px] leading-[1.7]">
            Questions about this page? Email{' '}
            <a href="mailto:support@resortpro.site" className="font-bold underline" style={{ color: GOLD }}>
              support@resortpro.site
            </a>
            .
          </p>
        </div>
      </main>

      {/* Footer — matches apps/web/src/components/landing/LandingPage.tsx */}
      <footer style={{ background: NAVY }} className="text-white">
        <div className="mx-auto flex max-w-[900px] flex-col items-center gap-6 px-5 py-10 sm:flex-row sm:justify-between sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              className="relative flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-lg"
              style={{ background: '#fff' }}
            >
              <Image
                src="/brand/resortpro-icon-mark.png"
                alt="ResortPro"
                fill
                sizes="36px"
                className="scale-125 object-cover"
              />
            </span>
            <span className="text-base font-extrabold">ResortPro</span>
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-semibold">
            <Link href="/terms" className="transition-colors hover:opacity-70" style={{ color: GOLD }}>Terms</Link>
            <Link href="/privacy" className="transition-colors hover:opacity-70" style={{ color: GOLD }}>Privacy</Link>
            <Link href="/refund" className="transition-colors hover:opacity-70" style={{ color: GOLD }}>Refund</Link>
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
  return <h2 className="mt-10 mb-3 text-[1.35rem] font-extrabold" style={{ color: NAVY }}>{children}</h2>;
}
export function P({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-[15px] leading-[1.75]" style={{ color: MUTED }}>{children}</p>;
}
export function UL({ children }: { children: ReactNode }) {
  return <ul className="mb-4 ml-5 list-disc space-y-2 text-[15px] leading-[1.7]" style={{ color: MUTED }}>{children}</ul>;
}
