import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from '@/components/providers';
import { ClarityScript } from '@/components/analytics/ClarityScript';
import './globals.css';

export const metadata: Metadata = {
  title: { template: '%s | ResortPro', default: 'ResortPro – Resort Management Platform' },
  description: 'All-in-one resort management software for small resort owners',
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
