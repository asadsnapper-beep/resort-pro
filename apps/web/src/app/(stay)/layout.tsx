import type { Metadata } from 'next';
import { BrandLogo } from '@/components/brand/BrandLogo';

export const metadata: Metadata = {
  title: {
    default:  'Discover Resorts in South Asia — stay.resortpro.site',
    template: '%s | stay.resortpro.site',
  },
  description:
    'Find eco, agro, beach & hill resorts across Bangladesh, India, Sri Lanka and Nepal. Browse by map or list. Book directly with the resort.',
  keywords: [
    'eco resort Bangladesh', 'agro resort South Asia', 'beach resort Bali',
    'hill resort Bandarban', 'resort discovery map', 'sustainable travel South Asia',
    'resort booking Bangladesh', 'resort finder',
  ],
  metadataBase: new URL('https://stay.resortpro.site'),
  openGraph: {
    siteName:    'stay.resortpro.site',
    type:        'website',
    title:       'Discover Resorts in South Asia',
    description: 'Browse eco, agro, beach & hill resorts on an interactive map.',
    images: [{
      url:    '/og-cover.png',
      width:  1200,
      height: 630,
      alt:    'stay.resortpro.site — Resort Discovery Map',
    }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Discover Resorts in South Asia',
    description: 'Browse eco, agro, beach & hill resorts on an interactive map.',
  },
  robots: {
    index:  true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function StayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8f6f1] font-sans text-resort-900">
      {/* Topbar */}
      <header className="sticky top-0 z-50 border-b border-black/5 bg-[#f8f6f1]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <a href="/discover" className="group flex items-center gap-3">
            <BrandLogo size="sm" />
            <span className="rounded-full bg-lime-200 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-resort-900">Stay</span>
          </a>

          <nav className="flex items-center gap-1 text-sm">
            <a href="/discover" className="hidden rounded-full px-3 py-1.5 font-bold text-slate-600 transition-colors hover:bg-white hover:text-resort-900 sm:block">
              Map
            </a>
            <a href="/discover?view=list" className="hidden rounded-full px-3 py-1.5 font-bold text-slate-600 transition-colors hover:bg-white hover:text-resort-900 sm:block">
              List
            </a>
            <a href="/blog" className="rounded-full px-3 py-1.5 font-bold text-slate-600 transition-colors hover:bg-white hover:text-resort-900">
              Blog
            </a>
            <a
              href="https://resortpro.site"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 rounded-full bg-resort-900 px-4 py-2 text-xs font-extrabold text-white transition-colors hover:bg-resort-800">
              For Resort Owners →
            </a>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      {/* Footer */}
      <footer className="mt-16 bg-resort-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 py-10 text-sm text-white/50 sm:flex-row">
          <span>© {new Date().getFullYear()} ResortPro Stay — direct stays, better hospitality.</span>
          <div className="flex gap-4">
            <a href="/discover" className="hover:text-lime-300">Discover</a>
            <a href="/blog" className="hover:text-lime-300">Blog</a>
            <a href="https://resortpro.site" className="hover:text-lime-300">For Owners</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
