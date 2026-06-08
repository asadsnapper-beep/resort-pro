/* ── ThemeConfig — uploadable/AI-generated theme schema ──────────────────────
   JSON config যা super admin upload করবে বা AI generate করবে।
   ConfigThemeRenderer এই config পড়ে পুরো resort website render করে।
──────────────────────────────────────────────────────────────────────────── */

export type HeroLayout    = 'fullscreen' | 'split' | 'minimal'
export type AboutLayout   = 'image-right' | 'image-left' | 'centered'
export type GalleryLayout = 'masonry' | 'grid'
export type NavbarStyle   = 'transparent-to-white' | 'solid' | 'transparent'
export type FooterDivider = 'wave' | 'straight' | 'none'
export type CtaStyle      = 'pill' | 'rounded' | 'sharp'
export type FontStyle     = 'serif' | 'sans-serif'

export interface ThemeConfig {
  key:      string
  name:     string
  version?: string

  colors: {
    primary:    string  // main brand color — nav active, primary buttons
    accent:     string  // highlight color — badges, CTAs, icon accents
    background: string  // page background
    surface:    string  // card / section backgrounds
    text:       string  // body text
    textMuted:  string  // secondary / muted text
  }

  fonts: {
    heading:      FontStyle    // 'serif' or 'sans-serif'
    body:         FontStyle
    googleFonts?: string[]     // e.g. ['Playfair Display', 'Inter']
  }

  navbar: {
    style:      NavbarStyle
    logoEmoji?: string          // shown next to tenant name when no logoUrl
    links?:     string[]        // section ids to show; defaults to all sections minus 'hero'
  }

  hero: {
    layout:           HeroLayout
    overlayOpacity?:  number    // 0–1, default 0.50
    overlayColor?:    string    // explicit rgba — overrides overlayOpacity
    textAlign?:       'left' | 'center' | 'right'
    ctaStyle?:        CtaStyle
    showStats?:       boolean   // check-in/out/rooms stats strip
  }

  about?: {
    layout?:      AboutLayout
    showBullets?: boolean
    bullets?:     string[]
  }

  rooms?: {
    cardBackground?: string   // card bg; defaults to colors.surface
    ctaLabel?:       string   // 'Book Now', 'View Details', etc.
  }

  gallery?: {
    layout?:   GalleryLayout
    captions?: string[]
  }

  footer?: {
    background?: string
    divider?:    FooterDivider
  }

  sections:   string[]   // ordered section ids to render
  customCSS?: string     // injected into <style> — must be sanitized server-side
}

/* ── Default config — fallback values when a field is omitted ─────────────── */
export const DEFAULT_CONFIG: ThemeConfig = {
  key:  'default',
  name: 'Default',
  colors: {
    primary:    '#1a6b5e',
    accent:     '#d4a853',
    background: '#ffffff',
    surface:    '#f9fafb',
    text:       '#111827',
    textMuted:  '#6b7280',
  },
  fonts: {
    heading: 'sans-serif',
    body:    'sans-serif',
  },
  navbar: {
    style:     'transparent-to-white',
    logoEmoji: '🏨',
  },
  hero: {
    layout:         'fullscreen',
    overlayOpacity: 0.5,
    textAlign:      'center',
    ctaStyle:       'pill',
    showStats:      true,
  },
  about: {
    layout:      'image-right',
    showBullets: false,
  },
  rooms: {
    ctaLabel: 'Book Now',
  },
  gallery: {
    layout:   'masonry',
    captions: ['Resort View', 'Accommodation', 'Dining', 'Leisure', 'Nature', 'Sunset', 'Pool', 'Garden'],
  },
  footer: {
    background: '#111827',
    divider:    'none',
  },
  sections: ['hero', 'about', 'rooms', 'gallery', 'testimonials', 'availability', 'booking', 'contact'],
}

/* ── Merge helper — applies defaults for missing fields ───────────────────── */
export function mergeConfig(partial: Partial<ThemeConfig>): ThemeConfig {
  return {
    ...DEFAULT_CONFIG,
    ...partial,
    colors:  { ...DEFAULT_CONFIG.colors,  ...partial.colors  },
    fonts:   { ...DEFAULT_CONFIG.fonts,   ...partial.fonts   },
    navbar:  { ...DEFAULT_CONFIG.navbar,  ...partial.navbar  },
    hero:    { ...DEFAULT_CONFIG.hero,    ...partial.hero    },
    about:   { ...DEFAULT_CONFIG.about,   ...partial.about   },
    rooms:   { ...DEFAULT_CONFIG.rooms,   ...partial.rooms   },
    gallery: { ...DEFAULT_CONFIG.gallery, ...partial.gallery },
    footer:  { ...DEFAULT_CONFIG.footer,  ...partial.footer  },
  }
}
