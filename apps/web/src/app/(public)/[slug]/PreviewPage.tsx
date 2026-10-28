'use client';

/**
 * Client-side preview page rendered when ?preview=themeKey is in the URL.
 *
 * Receives server-fetched data as initialData, then re-renders the theme live
 * as the owner edits fields in the builder — no save needed.
 *
 * The order of the three steps below is the fix for WB-003 and is not
 * arbitrary; see lib/preview-channel.ts for what was racing.
 */

import { useState, useEffect } from 'react';
import { getTheme } from '@/components/themes/registry';
import { ConfigThemeRenderer } from '@/components/themes/config-renderer';
import {
  PREVIEW_READY,
  PREVIEW_UPDATE,
  PREVIEW_STORAGE_KEY,
  isTrustedPreviewMessage,
} from '@/lib/preview-channel';
import type { ResortData } from '@/components/themes/types';

interface Props {
  initialData: ResortData;
  themeKey: string;
  configJson: unknown | null;
}

export function PreviewPage({ initialData, themeKey, configJson }: Props) {
  const [data, setData] = useState<ResortData>(initialData);
  const [mergeCount, setMergeCount] = useState(0);
  const ThemeComponent = getTheme(themeKey);

  useEffect(() => {
    const applyOverride = (override: Partial<NonNullable<ResortData['website']>>) => {
      setData(prev => ({ ...prev, website: { ...prev.website, ...override } }));
      setMergeCount(n => n + 1);
    };

    // 1. Listen first. Anything that arrives after this point is handled, so
    //    the steps below cannot open a gap for a message to fall through.
    function onMessage(e: MessageEvent) {
      if (!isTrustedPreviewMessage(e, window.parent)) return;
      if (e.data?.type !== PREVIEW_UPDATE || !e.data.payload) return;
      applyOverride(e.data.payload);
    }
    window.addEventListener('message', onMessage);

    // 2. sessionStorage, for a preview opened in its own tab — there is no
    //    parent to ask, so the handshake below cannot help.
    try {
      const stored = sessionStorage.getItem(PREVIEW_STORAGE_KEY);
      if (stored) applyOverride(JSON.parse(stored));
    } catch {}

    // 3. Tell the editor we are listening, and let it answer with the form as
    //    it stands. This is what makes the order of the two sides irrelevant:
    //    an update posted while this document was still loading used to be
    //    delivered to a window with no listener and silently dropped.
    if (window.parent !== window) {
      window.parent.postMessage({ type: PREVIEW_READY }, window.location.origin);
    }

    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <>
      {/* Preview banner */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-gray-900/95 backdrop-blur-sm text-white text-sm px-5 py-2.5 rounded-full shadow-xl border border-gray-700 pointer-events-none select-none">
        <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
        Preview — <strong>{themeKey}</strong>
        {mergeCount > 0 && (
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
