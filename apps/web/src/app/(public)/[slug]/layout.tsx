import Script from 'next/script';
import { GoogleAnalyticsTracker } from './GoogleAnalyticsTracker';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getGaId(slug: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}/site/${slug}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.data?.website?.googleAnalyticsId as string) || null;
  } catch {
    return null;
  }
}

export default async function SlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const gaId = await getGaId(params.slug);

  return (
    <>
      {/* Google Analytics 4 — only injected when the hotel owner has set a GA ID */}
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}', { send_page_view: true });
            `}
          </Script>
        </>
      )}
      {/* Built-in visitor counter (shows on resort owner dashboard) */}
      <GoogleAnalyticsTracker slug={params.slug} />
      {children}
    </>
  );
}
