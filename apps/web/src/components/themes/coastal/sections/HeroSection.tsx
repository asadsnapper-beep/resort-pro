'use client'
import { ArrowRight } from 'lucide-react'
import type { ResortData } from '../../types'

interface HeroSectionProps {
  data:     ResortData
  scrollTo: (id: string) => void
}

export function HeroSection({ data, scrollTo }: HeroSectionProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '#0891b2'
  const accent  = website?.accentColor  || '#d97706'

  return (
    <section id="hero" className="relative min-h-screen flex overflow-hidden">
      {/* Left: image (60%) */}
      <div className="relative w-full lg:w-[60%] min-h-screen">
        {website?.heroImage ? (
          <>
            <img
              src={website.heroImage}
              alt={tenant.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Teal/coral gradient overlay */}
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${primary}99 0%, transparent 60%, ${accent}55 100%)` }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${primary} 0%, #0e7490 50%, #164e63 100%)` }}
          />
        )}

        {/* Mobile: text overlay on image */}
        <div className="lg:hidden relative z-10 h-full flex flex-col items-center justify-center text-center text-white px-8 py-32">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60 mb-4">{tenant.name}</p>
          <h1 className="text-4xl font-bold leading-tight mb-4">{website?.heroTitle || tenant.name}</h1>
          {website?.heroSubtitle && (
            <p className="text-white/80 mb-8 max-w-sm leading-relaxed">{website.heroSubtitle}</p>
          )}
          <button
            onClick={() => scrollTo('availability')}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-sm text-white transition-all hover:scale-105 shadow-lg"
            style={{ backgroundColor: accent, color: '#1a1a1a' }}>
            Check Availability <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Right: info panel (40%) — desktop only */}
      <div className="hidden lg:flex w-[40%] flex-col justify-center px-12 py-20 bg-white">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] mb-5" style={{ color: primary }}>
          {tenant.name}
        </p>
        <h1 className="text-5xl font-bold text-slate-900 leading-tight mb-6">
          {website?.heroTitle || tenant.name}
        </h1>
        {website?.heroSubtitle && (
          <p className="text-slate-500 leading-relaxed mb-10 text-lg">{website.heroSubtitle}</p>
        )}

        {/* Quick stats */}
        <div className="flex gap-8 mb-10 pb-10 border-b border-slate-100">
          {[
            { label: 'Check-in',  value: tenant.checkInTime  || '14:00' },
            { label: 'Check-out', value: tenant.checkOutTime || '11:00' },
            { label: 'Rooms',     value: `${data.rooms.length}` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-2xl font-bold" style={{ color: primary }}>{value}</p>
              <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => scrollTo('availability')}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-sm text-white transition-all hover:opacity-90 shadow-md"
            style={{ backgroundColor: primary }}>
            Check Availability <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => scrollTo('rooms')}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-sm border-2 transition-all hover:bg-slate-50"
            style={{ borderColor: primary, color: primary }}>
            Our Rooms
          </button>
        </div>
      </div>

      {/* Wave divider at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <path
            d="M0 30 C240 60 480 0 720 30 C960 60 1200 0 1440 30 L1440 60 L0 60 Z"
            fill="white"
          />
        </svg>
      </div>
    </section>
  )
}
