import type { Metadata } from 'next';

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
    <div className="min-h-screen bg-[#f8faf9] font-sans">
      {/* Topbar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/discover" className="flex items-center gap-2 group">
            <span className="w-7 h-7 rounded-lg bg-[#1a6b5e] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white" stroke="currentColor" strokeWidth={2.2}>
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </span>
            <span className="font-bold text-[#1a6b5e] text-base group-hover:opacity-80 transition-opacity">
              stay<span className="text-[#d4a853]">.</span>resortpro
            </span>
          </a>

          <nav className="flex items-center gap-1 text-sm">
            <a href="/discover" className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-[#1a6b5e] hover:bg-[#f0faf8] transition-colors font-medium">
              Map
            </a>
            <a href="/discover?view=list" className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-[#1a6b5e] hover:bg-[#f0faf8] transition-colors font-medium">
              List
            </a>
            <a href="/blog" className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-[#1a6b5e] hover:bg-[#f0faf8] transition-colors font-medium">
              Blog
            </a>
            <a
              href="https://resortpro.com"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 px-3 py-1.5 rounded-lg border border-[#1a6b5e] text-[#1a6b5e] text-xs font-semibold hover:bg-[#f0faf8] transition-colors">
              For Resort Owners →
            </a>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <span>© {new Date().getFullYear()} stay.resortpro.site — Powered by <a href="https://resortpro.com" className="text-[#1a6b5e] hover:underline">ResortPro</a></span>
          <div className="flex gap-4">
            <a href="/discover" className="hover:text-gray-600">Discover</a>
            <a href="/blog"     className="hover:text-gray-600">Blog</a>
            <a href="https://resortpro.com" className="hover:text-gray-600">For Owners</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
