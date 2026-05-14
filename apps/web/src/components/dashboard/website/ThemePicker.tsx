'use client'
import { useState, useEffect } from 'react'
import { CheckCircle2, ExternalLink, Sparkles, Loader2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

/* ── Fallback static list (used if API unavailable) ──────────────────────── */
const FALLBACK_THEMES: Theme[] = [
  {
    key:         'luxe',
    name:        'Luxe Gold',
    description: 'Elegant luxury design with gold accents and full-screen hero',
    isPremium:   false,
    previewImage: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80',
  },
  {
    key:         'minimal',
    name:        'Minimal Clean',
    description: 'Clean modern design with focus on content and whitespace',
    isPremium:   false,
    previewImage: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&q=80',
  },
  {
    key:         'coastal',
    name:        'Coastal Breeze',
    description: 'Ocean-inspired design for beach and coastal properties',
    isPremium:   false,
    previewImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80',
  },
]

/* ── Theme palette hints shown on hover ──────────────────────────────────── */
const THEME_META: Record<string, { primary: string; accent: string; tags: string[] }> = {
  luxe:    { primary: '#1a6b5e', accent: '#d4a853', tags: ['Luxury', 'Gold Accents', 'Full-Screen Hero'] },
  minimal: { primary: '#2563eb', accent: '#0f172a', tags: ['Clean', 'Modern', 'Content-First'] },
  coastal: { primary: '#0891b2', accent: '#d97706', tags: ['Beach', 'Ocean', 'Wave Animations'] },
}

interface Theme {
  key:          string
  name:         string
  description:  string
  previewImage?: string
  isPremium:    boolean
}

interface ThemePickerProps {
  currentTheme: string
  slug:         string
  onSelect:     (key: string) => void
}

export function ThemePicker({ currentTheme, slug, onSelect }: ThemePickerProps) {
  const [themes,  setThemes]  = useState<Theme[]>(FALLBACK_THEMES)
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/site/${slug}/themes`)
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setThemes(json.data)
        }
      })
      .catch(() => { /* silently use fallback */ })
      .finally(() => setLoading(false))
  }, [slug])

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Choose Your Website Theme</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your entire public website will update immediately after saving.
          </p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
      </div>

      {/* Theme grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {themes.map(theme => {
          const isSelected = currentTheme === theme.key
          const meta       = THEME_META[theme.key]
          const isHovered  = hovered === theme.key

          return (
            <div
              key={theme.key}
              onClick={() => onSelect(theme.key)}
              onMouseEnter={() => setHovered(theme.key)}
              onMouseLeave={() => setHovered(null)}
              className={`group relative rounded-2xl border-2 overflow-hidden cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'border-resort-600 shadow-lg shadow-resort-100/50'
                  : 'border-gray-200 hover:border-resort-300 hover:shadow-md'
              }`}
            >
              {/* Preview image */}
              <div className="relative h-44 overflow-hidden bg-gray-100">
                {theme.previewImage ? (
                  <img
                    src={theme.previewImage}
                    alt={theme.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  /* Color swatch fallback */
                  <div
                    className="w-full h-full flex items-end p-3"
                    style={{
                      background: meta
                        ? `linear-gradient(135deg, ${meta.primary} 0%, ${meta.accent}80 100%)`
                        : 'linear-gradient(135deg, #e2e8f0, #f8fafc)',
                    }}
                  >
                    <span className="text-white/80 text-xs font-semibold">{theme.name}</span>
                  </div>
                )}

                {/* Dark overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-200" />

                {/* Active badge */}
                {isSelected && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-resort-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Active
                  </div>
                )}

                {/* Premium badge */}
                {theme.isPremium && (
                  <div className="absolute top-3 left-3 flex items-center gap-1 bg-amber-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
                    <Sparkles className="h-3 w-3" /> Premium
                  </div>
                )}

                {/* Color palette dots — shown on hover */}
                {meta && isHovered && (
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 transition-opacity duration-200">
                    <div className="h-5 w-5 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: meta.primary }} title="Primary" />
                    <div className="h-5 w-5 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: meta.accent }} title="Accent" />
                    <span className="text-xs text-white/80 font-medium ml-0.5">Default palette</span>
                  </div>
                )}
              </div>

              {/* Card body */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-1">
                  <h4 className="font-bold text-gray-900 text-sm">{theme.name}</h4>
                  {!theme.isPremium && (
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      Free
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mb-3">{theme.description}</p>

                {/* Tags */}
                {meta && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {meta.tags.map(tag => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Preview link — only for selected theme */}
                {isSelected && (
                  <a
                    href={`/${slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center justify-center gap-1.5 w-full text-xs font-medium text-resort-600 hover:text-resort-800 border border-resort-200 rounded-lg py-1.5 hover:bg-resort-50 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Preview Live Site
                  </a>
                )}
              </div>

              {/* Selection ring glow */}
              {isSelected && (
                <div className="absolute inset-0 pointer-events-none rounded-2xl ring-2 ring-resort-600 ring-inset" />
              )}
            </div>
          )
        })}
      </div>

      {/* Hint */}
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
        Click a theme to select it, then hit <strong>Save &amp; Publish</strong> to apply.
      </p>
    </div>
  )
}
