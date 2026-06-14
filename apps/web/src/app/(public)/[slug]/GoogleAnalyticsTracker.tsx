'use client';

import { useEffect } from 'react';
import { publicWebsiteApi } from '@/lib/api';

export function GoogleAnalyticsTracker({ slug }: { slug: string }) {
  useEffect(() => {
    // Fire-and-forget — never blocks render, never shows errors to visitor
    publicWebsiteApi.trackPageView(slug);
  }, [slug]);

  return null;
}
