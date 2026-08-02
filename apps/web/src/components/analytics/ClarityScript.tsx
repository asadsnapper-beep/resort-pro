'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

// Marketing pages only — see plan/demo-gate-and-click-tracking.md §3.
// Deliberately an allowlist, not a denylist: a denylist could silently miss
// a future route and start recording it. Never add /dashboard, /admin,
// /auth, /pay, /onboarding, or /[slug] tenant sites here — those carry real
// guest/booking/payment data that must never leave the app in a session
// recording.
const MARKETING_PATHS = ['/', '/bn', '/plans', '/try'];

function isMarketingPath(pathname: string): boolean {
  return MARKETING_PATHS.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)));
}

export function ClarityScript() {
  const pathname = usePathname();
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;

  if (!clarityId || !isMarketingPath(pathname)) return null;

  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${clarityId}");`}
    </Script>
  );
}
