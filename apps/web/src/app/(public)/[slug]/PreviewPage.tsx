'use client';

/**
 * Client-side preview page rendered when ?preview=themeKey is in the URL.
 *
 * Receives server-fetched data as initialData, then:
 *  1. On mount: reads sessionStorage for any unsaved form data
 *  2. Listens for postMessage({ type: 'rp-preview-update', payload: WebsiteForm })
 *     sent by the dashboard editor iframe parent
 *  3. Re-renders the theme live as the owner edits fields — no save needed
 */

import { useState, useEffect, useRef } from 'react';
import { getTheme } from '@/components/themes/registry';
import { ConfigThemeRenderer } from '@/components/themes/config-renderer';
import type { ResortData } from '@/components/themes/types';

const STORAGE_KEY = 'rp-website-preview';

interface Props {
  initialData: ResortData;
  themeKey: string;
  configJson: unknown | null;
}

export function PreviewPage({ initialData, themeKey, configJson }: Props) {
  const [data, setData] = useState<ResortData>(initialData);
  const ThemeComponent = getTheme(themeKey);
  const mergeCount = useRef(0);

  useEffect(() => {
    // 1. Read sessionStorage on mount (handles page reload / new tab cases)
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const override = JSON.parse(stored);
        setData(prev => ({ ...prev, website: { ...prev.website, ...override } }));
        mergeCount.current++;
      }
    } catch {}

    // 2. Listen for real-time postMessage updates from the dashboard iframe parent
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'rp-preview-update' && e.data.payload) {
        setData(prev => ({ ...prev, website: { ...prev.website, ...e.data.payload } }));
        mergeCount.current++;
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <>
      {/* Preview banner */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-gray-900/95 backdrop-blur-sm text-white text-sm px-5 py-2.5 rounded-full shadow-xl border border-gray-700 pointer-events-none select-none">
        <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
        Preview — <strong>{themeKey}</strong>
        {mergeCount.current > 0 && (
          <span className="ml-1 text-xs text-green-400">● live</span>
        )}
      </div>

      {configJson
        ? <ConfigThemeRenderer data={data} config={configJson as Record<string, unknown>} />
        : <ThemeComponent data={data} />
      }
    </>
  );
}
