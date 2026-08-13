import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from '@/components/providers';
import { ClarityScript } from '@/components/analytics/ClarityScript';
import './globals.css';

export const metadata: Metadata = {
  // Without this, Next resolves relative OG/twitter image URLs (below)
  // against http://localhost:3000 even in the production build, so social
  // scrapers on the live marketing site got a dead localhost image link.
  // This root layout serves the bare apex/marketing domain (see
  // middleware.ts's ALLOWED_HOSTS comment); the (stay) segment already sets
  // its own metadataBase for stay.resortpro.site, which overrides this one
  // for pages under that segment.
  metadataBase: new URL('https://resortpro.site'),
  title: { template: '%s | ResortPro', default: 'ResortPro – Resort Management Platform' },
  description: 'All-in-one resort management software for small resort owners',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'ResortPro – Resort Management, Simplified',
    description: 'All-in-one resort management software for small resort owners',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'ResortPro' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ResortPro – Resort Management, Simplified',
    description: 'All-in-one resort management software for small resort owners',
    images: ['/og-image.png'],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
        <ClarityScript />
      </body>
    </html>
  );
}
