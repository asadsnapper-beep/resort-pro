import Link from 'next/link';
import { ArrowLeft, BookOpen } from 'lucide-react';

// Palette matches the landing page's design system
// (claude.ai/design/p/d56b55b0-882c-44d6-aecd-3667a5499d43 — "ResortPro Landing.dc.html").
const NAVY = '#14314D';
const GOLD = '#CFA153';

interface TocItem {
  id: string;
  label: string;
}

interface DocLayoutProps {
  title: string;
  description: string;
  readTime: string;
  tag: string;
  tagColor: string;
  toc: TocItem[];
  children: React.ReactNode;
}

export function DocLayout({ title, description, readTime, tag, tagColor, toc, children }: DocLayoutProps) {
  return (
    <>
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-[#EDE7DD] bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg"
                style={{ background: NAVY }}
              >
                <span className="text-sm font-bold" style={{ color: GOLD }}>R</span>
              </div>
              <span className="font-extrabold" style={{ color: NAVY }}>ResortPro</span>
            </Link>
            <span className="text-[#EDE7DD]">/</span>
            <Link href="/docs" className="text-sm text-[#5B6B79] transition-colors hover:opacity-70">Help Center</Link>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white transition-colors"
            style={{ background: NAVY }}
          >
            Go to Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex gap-10">

          {/* ── Sidebar (TOC) ─────────────────────────────────────────────── */}
          <aside className="hidden w-56 shrink-0 lg:block">
            <div className="sticky top-24">
              <Link
                href="/docs"
                className="mb-6 flex items-center gap-2 text-sm text-[#5B6B79] transition-colors hover:opacity-70"
              >
                <ArrowLeft className="h-4 w-4" />
                Help Center
              </Link>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#8B95A0]">
                On this page
              </p>
              <nav className="space-y-1">
                {toc.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block rounded-lg px-3 py-1.5 text-sm text-[#5B6B79] transition-colors hover:bg-[#F7F3EE]"
                    style={{ color: '#5B6B79' }}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* ── Main content ──────────────────────────────────────────────── */}
          <main className="min-w-0 flex-1">
            {/* Header */}
            <div className="mb-8 border-b border-[#EDE7DD] pb-8">
              <div className="mb-3 flex items-center gap-3">
                <Link
                  href="/docs"
                  className="flex items-center gap-1.5 text-xs text-[#8B95A0] transition-colors hover:opacity-70"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Help Center
                </Link>
                <span className="text-[#EDE7DD]">/</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${tagColor}`}>
                  {tag}
                </span>
              </div>
              <h1 className="mb-3 text-3xl font-extrabold" style={{ color: NAVY }}>{title}</h1>
              <p className="text-[#5B6B79]">{description}</p>
              <p className="mt-2 text-xs text-[#8B95A0]">{readTime}</p>
            </div>

            {/* Doc content */}
            <div className="doc-content">
              {children}
            </div>

            {/* Footer nav */}
            <div className="mt-12 flex items-center justify-between border-t border-[#EDE7DD] pt-6">
              <Link
                href="/docs"
                className="flex items-center gap-2 text-sm text-[#5B6B79] transition-colors hover:opacity-70"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Help Center
              </Link>
              <Link
                href="/dashboard/support"
                className="text-sm font-semibold hover:underline"
                style={{ color: GOLD }}
              >
                Need help? Open a ticket →
              </Link>
            </div>
          </main>
        </div>
      </div>

      <style>{`
        .doc-content h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #111827;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #f3f4f6;
          scroll-margin-top: 5rem;
        }
        .doc-content h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #374151;
          margin-top: 1.75rem;
          margin-bottom: 0.75rem;
          scroll-margin-top: 5rem;
        }
        .doc-content p {
          font-size: 0.9375rem;
          line-height: 1.75;
          color: #4b5563;
          margin-bottom: 1rem;
        }
        .doc-content ul {
          margin-bottom: 1rem;
          padding-left: 1.25rem;
          list-style: disc;
        }
        .doc-content ul li {
          font-size: 0.9375rem;
          line-height: 1.75;
          color: #4b5563;
          margin-bottom: 0.25rem;
        }
        .doc-content ol {
          margin-bottom: 1rem;
          padding-left: 1.25rem;
          list-style: decimal;
        }
        .doc-content ol li {
          font-size: 0.9375rem;
          line-height: 1.75;
          color: #4b5563;
          margin-bottom: 0.25rem;
        }
        .doc-content code {
          font-family: ui-monospace, monospace;
          font-size: 0.8125rem;
          background: #F7F3EE;
          color: #14314D;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
        }
        .doc-content pre {
          background: #0f172a;
          color: #e2e8f0;
          border-radius: 0.75rem;
          padding: 1.25rem 1.5rem;
          overflow-x: auto;
          margin-bottom: 1.25rem;
          font-size: 0.8125rem;
          line-height: 1.7;
        }
        .doc-content pre code {
          background: transparent;
          color: inherit;
          padding: 0;
          border-radius: 0;
        }
        .doc-content blockquote {
          border-left: 3px solid #CFA153;
          background: #F7F3EE;
          border-radius: 0 0.5rem 0.5rem 0;
          padding: 0.875rem 1.25rem;
          margin-bottom: 1.25rem;
          color: #78350f;
          font-size: 0.9rem;
        }
        .doc-content .info-box {
          border-left: 3px solid #14314D;
          background: #F7F3EE;
          border-radius: 0 0.5rem 0.5rem 0;
          padding: 0.875rem 1.25rem;
          margin-bottom: 1.25rem;
          color: #14314D;
          font-size: 0.9rem;
        }
        .doc-content strong {
          font-weight: 600;
          color: #111827;
        }
        .doc-content table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1.5rem;
          font-size: 0.875rem;
        }
        .doc-content th {
          background: #f9fafb;
          text-align: left;
          padding: 0.625rem 1rem;
          font-weight: 600;
          color: #374151;
          border: 1px solid #e5e7eb;
        }
        .doc-content td {
          padding: 0.625rem 1rem;
          color: #4b5563;
          border: 1px solid #e5e7eb;
          vertical-align: top;
        }
        .doc-content tr:hover td {
          background: #f9fafb;
        }
      `}</style>
    </>
  );
}
