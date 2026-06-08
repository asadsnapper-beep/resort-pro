'use client'
import { ArrowDown } from 'lucide-react'
import type { ResortData } from '../../types'
import type { ThemeConfig } from '../config-types'
import { heroImg } from '../../_utils/images'

interface Props {
  data:      ResortData
  config:    ThemeConfig
  scrollTo:  (id: string) => void
  showScrim?: boolean  // true when navbar is transparent & not yet scrolled
}

function ctaRadius(style?: string) {
  if (style === 'pill')  return '9999px'
  if (style === 'sharp') return '4px'
  return '12px'
}

export function ConfigHero({ data, config, scrollTo, showScrim }: Props) {
  const { tenant, website } = data
  const { colors, hero, fonts } = config
  const primary     = website?.primaryColor || colors.primary
  const accent      = website?.accentColor  || colors.accent
  const headingFont = fonts.heading === 'serif' ? 'Georgia, Cambria, serif' : 'inherit'
  const textAlign   = hero.textAlign || 'center'
  const radius      = ctaRadius(hero.ctaStyle)

  /* ── Fullscreen ──────────────────────────────────────────────────────────── */
  if (hero.layout === 'fullscreen') {
    const overlay = hero.overlayColor || `rgba(0,0,0,${hero.overlayOpacity ?? 0.50})`

    return (
      <section
        id="hero"
        className="relative flex items-center justify-center overflow-hidden"
        style={{ minHeight: '100vh' }}
      >
        <img
          src={heroImg(website?.heroImage)}
          alt={tenant.name}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Main overlay */}
        <div className="absolute inset-0" style={{ background: overlay }} />

        {/* Gradient scrim — ensures navbar text is always readable on transparent navbars */}
        {showScrim && (
          <div
            className="absolute inset-x-0 top-0 pointer-events-none"
            style={{
              height: '180px',
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 100%)',
            }}
          />
        )}

        <div
          className="relative z-10 max-w-4xl mx-auto px-6 text-white"
          style={{ textAlign, paddingTop: '5rem' }}
        >
          <p
            className="inline-block text-xs font-bold uppercase tracking-[0.4em] px-4 py-1.5 rounded-full mb-8"
            style={{ backgroundColor: `${accent}25`, color: accent, border: `1px solid ${accent}50` }}
          >
            {tenant.name}
          </p>

          <h1
            className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6 drop-shadow-lg"
            style={{ fontFamily: headingFont }}
          >
            {website?.heroTitle || tenant.name}
          </h1>

          {website?.heroSubtitle && (
            <p className="text-white/75 text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
              {website.heroSubtitle}
            </p>
          )}

          <div
            className="flex flex-col sm:flex-row items-center gap-4"
            style={{
              justifyContent:
                textAlign === 'center' ? 'center'
                : textAlign === 'right' ? 'flex-end'
                : 'flex-start',
            }}
          >
            <button
              onClick={() => scrollTo('availability')}
              className="px-8 py-4 font-semibold text-sm transition-all hover:scale-105 shadow-xl"
              style={{ backgroundColor: accent, color: colors.text, borderRadius: radius }}
            >
              Check Availability
            </button>
            <button
              onClick={() => scrollTo('rooms')}
              className="px-8 py-4 font-semibold text-sm border-2 border-white/60 text-white hover:bg-white/10 transition-all"
              style={{ borderRadius: radius }}
            >
              View Rooms
            </button>
          </div>

          {(hero.showStats ?? true) && (
            <div className="mt-16 flex items-center justify-center gap-10 text-center">
              {[
                { label: 'Check-in',  value: tenant.checkInTime  || '14:00' },
                { label: 'Check-out', value: tenant.checkOutTime || '11:00' },
                { label: 'Rooms',     value: `${data.rooms.length}` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-2xl font-bold" style={{ color: accent, fontFamily: headingFont }}>{value}</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => scrollTo(config.sections[1] || 'about')}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40 hover:text-white/70 transition-colors"
        >
          <span className="text-[10px] uppercase tracking-widest">Explore</span>
          <ArrowDown className="h-4 w-4 animate-bounce" />
        </button>
      </section>
    )
  }

  /* ── Split layout ────────────────────────────────────────────────────────── */
  if (hero.layout === 'split') {
    return (
      <section id="hero" className="min-h-screen grid md:grid-cols-2" style={{ paddingTop: '4rem' }}>
        <div className="relative overflow-hidden" style={{ minHeight: '50vh' }}>
          <img
            src={heroImg(website?.heroImage)}
            alt={tenant.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {showScrim && (
            <div
              className="absolute inset-x-0 top-0 pointer-events-none"
              style={{
                height: '160px',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 100%)',
              }}
            />
          )}
        </div>
        <div
          className="flex items-center justify-center px-12 py-20"
          style={{ backgroundColor: colors.background }}
        >
          <div className="max-w-md">
            <p className="text-xs font-bold uppercase tracking-[0.4em] mb-5" style={{ color: accent }}>
              {tenant.name}
            </p>
            <h1
              className="text-4xl md:text-5xl font-bold mb-6 leading-tight"
              style={{ fontFamily: headingFont, color: colors.text }}
            >
              {website?.heroTitle || tenant.name}
            </h1>
            {website?.heroSubtitle && (
              <p className="text-lg mb-10 leading-relaxed" style={{ color: colors.textMuted }}>
                {website.heroSubtitle}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => scrollTo('availability')}
                className="px-8 py-4 font-semibold text-sm text-white"
                style={{ backgroundColor: primary, borderRadius: radius }}
              >
                Check Availability
              </button>
              <button
                onClick={() => scrollTo('rooms')}
                className="px-6 py-4 font-semibold text-sm border-2"
                style={{ borderColor: primary, color: primary, borderRadius: radius }}
              >
                View Rooms
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  /* ── Minimal layout ──────────────────────────────────────────────────────── */
  return (
    <section
      id="hero"
      className="relative flex items-center justify-center"
      style={{ backgroundColor: primary, paddingTop: '8rem', paddingBottom: '5rem' }}
    >
      <div className="relative z-10 text-center text-white px-6 max-w-3xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-[0.4em] mb-4 opacity-60">{tenant.name}</p>
        <h1
          className="text-4xl md:text-5xl font-bold mb-6"
          style={{ fontFamily: headingFont }}
        >
          {website?.heroTitle || tenant.name}
        </h1>
        {website?.heroSubtitle && (
          <p className="text-white/70 text-lg mb-10">{website.heroSubtitle}</p>
        )}
        <button
          onClick={() => scrollTo('rooms')}
          className="px-8 py-3 font-semibold"
          style={{ backgroundColor: accent, color: colors.text, borderRadius: radius }}
        >
          Explore Rooms
        </button>
      </div>
    </section>
  )
}
