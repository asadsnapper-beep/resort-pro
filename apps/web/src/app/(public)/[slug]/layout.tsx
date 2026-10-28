import Script from 'next/script';
import { GoogleAnalyticsTracker } from './GoogleAnalyticsTracker';
import { getSiteData } from './site-data';

export default async function SlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  // Same call the page and its metadata make — `getSiteData` memoises it for
  // the request, so this costs nothing extra. It used to be a second fetch of
  // the same payload on an hour-long cache, which is why turning on analytics
  // appeared to do nothing until the hour was up.
  const gaId = (await getSiteData(params.slug))?.website?.googleAnalyticsId || null;

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
