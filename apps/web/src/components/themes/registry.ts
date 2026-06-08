import type React from 'react'
import type { ThemeProps } from './types'
import { LuxeTheme }                from './luxe'
import { MinimalTheme }             from './minimal'
import { CoastalTheme }             from './coastal'
import { TeaGardenEcoResortTheme }  from './tea-garden-eco-resort'

/* ── Hardcoded Theme Registry ────────────────────────────────────────────────
   নতুন hardcoded theme add করতে হলে:
   1. apps/web/src/components/themes/<key>/ folder-এ theme বানাও
   2. এই THEME_REGISTRY-তে import করে add করো
   3. packages/database/prisma/seed.ts-এ DB entry add করো (themeType: HARDCODED)

   Uploaded / AI-generated themes → ConfigThemeRenderer ব্যবহার করে (below)
──────────────────────────────────────────────────────────────────────────── */
export const THEME_REGISTRY: Record<string, React.ComponentType<ThemeProps>> = {
  luxe:                    LuxeTheme,
  minimal:                 MinimalTheme,
  coastal:                 CoastalTheme,
  'tea-garden-eco-resort': TeaGardenEcoResortTheme,
}

export type ThemeKey = keyof typeof THEME_REGISTRY

/* ── getTheme ────────────────────────────────────────────────────────────────
   key দিলে সেই hardcoded theme return করে।
   key না থাকলে বা unknown হলে → luxe (default fallback)
──────────────────────────────────────────────────────────────────────────── */
export function getTheme(key?: string | null): React.ComponentType<ThemeProps> {
  if (!key) return THEME_REGISTRY.luxe
  return THEME_REGISTRY[key] ?? THEME_REGISTRY.luxe
}

/* ── isHardcodedTheme ────────────────────────────────────────────────────────
   key টা hardcoded registry-তে আছে কিনা check করে।
   false হলে ConfigThemeRenderer ব্যবহার করতে হবে।
──────────────────────────────────────────────────────────────────────────── */
export function isHardcodedTheme(key?: string | null): boolean {
  if (!key) return false
  return key in THEME_REGISTRY
}
