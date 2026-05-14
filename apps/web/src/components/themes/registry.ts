import type React from 'react'
import type { ThemeProps } from './types'
import { LuxeTheme }    from './luxe'
import { MinimalTheme } from './minimal'
// Future themes:
// import { CoastalTheme } from './coastal'

/* ── Theme Registry ──────────────────────────────────────────────────────────
   নতুন theme add করতে হলে:
   1. apps/web/src/components/themes/<key>/ folder-এ theme বানাও
   2. এই THEME_REGISTRY-তে এ import করে add করো
   3. packages/database/prisma/seed.ts-এ DB entry add করো
──────────────────────────────────────────────────────────────────────────── */
export const THEME_REGISTRY: Record<string, React.ComponentType<ThemeProps>> = {
  luxe:    LuxeTheme,
  minimal: MinimalTheme,
  // coastal: CoastalTheme,
}

export type ThemeKey = keyof typeof THEME_REGISTRY

/* ── getTheme ────────────────────────────────────────────────────────────────
   key দিলে সেই theme return করে।
   key না থাকলে বা unknown হলে → luxe (default fallback)
──────────────────────────────────────────────────────────────────────────── */
export function getTheme(key?: string | null): React.ComponentType<ThemeProps> {
  if (!key) return THEME_REGISTRY.luxe
  return THEME_REGISTRY[key] ?? THEME_REGISTRY.luxe
}
