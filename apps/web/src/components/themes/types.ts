/* ── Shared theme types ──────────────────────────────────────────────────────
   এই types সব themes এবং widgets share করে।
   page.tsx → registry → ThemeComponent এই পুরো chain-এ এই types ব্যবহার হয়।
──────────────────────────────────────────────────────────────────────────── */

export type { ThemeConfig } from './config-renderer/config-types'

export interface ResortTenant {
  name: string
  slug: string
  phone?: string
  email?: string
  address?: string
  currency: string
  checkInTime: string
  checkOutTime: string
  logoUrl?: string
}

export interface ResortWebsite {
  heroTitle: string
  heroSubtitle?: string
  heroImage?: string
  aboutTitle?: string
  aboutText?: string
  aboutImage?: string
  galleryImages?: string[]
  testimonials?: { name: string; text: string; rating: number; avatar?: string }[]
  primaryColor?: string
  accentColor?: string
  templateId?: string
  seoTitle?: string
  seoDescription?: string
  // Social media
  facebookUrl?: string
  instagramUrl?: string
  twitterUrl?: string
  tiktokUrl?: string
  youtubeUrl?: string
  whatsappNumber?: string
  tripadvisorUrl?: string
  hiddenSections?: string[]
  sectionOrder?: string[]
  googleAnalyticsId?: string
}

export interface ResortRoom {
  id: string
  name: string
  type: string
  number: string
  basePrice: number
  maxOccupancy: number
  floor?: number
  images: string[]
  videos: string[]
  amenities: string[]
  description?: string
}

export interface ResortData {
  tenant:      ResortTenant
  website:     ResortWebsite | null
  rooms:       ResortRoom[]
  themeConfig?: import('./config-renderer/config-types').ThemeConfig | null
  // Tier 2 (TEMPLATE) — see plan/theme-contract.md
  themeType?:    string | null
  templateHtml?: string | null
  templateCss?:  string | null
}

/* ── Widget props — সব shared widget-এ এই props থাকবে ─────────────────────── */
export interface WidgetProps {
  slug: string
  primaryColor: string
  accentColor: string
  currency: string
  className?: string
}

/* ── Theme props — সব theme component-এ এই props থাকবে ───────────────────── */
export interface ThemeProps {
  data: ResortData
}
