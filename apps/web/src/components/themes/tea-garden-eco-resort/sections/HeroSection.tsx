'use client'
import { ArrowDown } from 'lucide-react'
import type { ResortData } from '../../types'
import { heroImg } from '../../_utils/images'

interface HeroSectionProps {
  data:     ResortData
  scrollTo: (id: string) => void
}

export function HeroSection({ data, scrollTo }: HeroSectionProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '#1a6b2a'
  const accent  = website?.accentColor  || '#d3d558'

  return (
    <section
      id="hero"
      className="relative flex items-center justify-center overflow-hidden"
      style={{ minHeight: '100vh', marginTop: '-4rem' }}
    >

      {/* Background image */}
      <img
        src={heroImg(website?.heroImage)}
        alt={tenant.name}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Layered dark-green gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(
            to bottom,
            rgba(10,40,15,0.55) 0%,
            rgba(10,40,15,0.55) 15%,
            rgba(10,40,15,0.40) 50%,
            rgba(10,40,15,0.75) 100%
          )`,
        }}
      />

      {/* Subtle horizontal mist band at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: `linear-gradient(to top, ${primary}99 0%, transparent 100%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center text-white pt-16">

        {/* Eyebrow */}
        <p
          className="inline-block text-xs font-bold uppercase tracking-[0.4em] px-4 py-1.5 rounded-full mb-8"
          style={{ backgroundColor: `${accent}25`, color: accent, border: `1px solid ${accent}50` }}
        >
          {tenant.name}
        </p>

        {/* Main heading — serif */}
        <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6 drop-shadow-lg">
          {website?.heroTitle || tenant.name}
        </h1>

        {website?.heroSubtitle && (
          <p className="text-white/75 text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
            {website.heroSubtitle}
          </p>
        )}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => scrollTo('availability')}
            className="px-8 py-4 rounded-full font-semibold text-sm transition-all hover:scale-105 shadow-xl"
            style={{ backgroundColor: accent, color: '#1a2d0a' }}
          >
            Check Availability
          </button>
          <button
            onClick={() => scrollTo('rooms')}
            className="px-8 py-4 rounded-full font-semibold text-sm border-2 border-white/60 text-white hover:bg-white/10 transition-all"
          >
            Explore Rooms
          </button>
        </div>

        {/* Quick stats */}
        <div className="mt-16 flex items-center justify-center gap-10 text-center">
          {[
            { label: 'Check-in',  value: tenant.checkInTime  || '14:00' },
            { label: 'Check-out', value: tenant.checkOutTime || '11:00' },
            { label: 'Rooms',     value: `${data.rooms.length}` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-2xl font-bold font-serif" style={{ color: accent }}>{value}</p>
              <p className="text-[10px] uppercase tracking-widest text-white/40 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <button
        onClick={() => scrollTo('about')}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40 hover:text-white/70 transition-colors"
      >
        <span className="text-[10px] uppercase tracking-widest">Discover</span>
        <ArrowDown className="h-4 w-4 animate-bounce" />
      </button>
    </section>
  )
}
