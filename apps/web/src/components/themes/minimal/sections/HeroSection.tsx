'use client'
import { ArrowDown } from 'lucide-react'
import type { ResortData } from '../../types'

interface HeroSectionProps {
  data:     ResortData
  scrollTo: (id: string) => void
}

export function HeroSection({ data, scrollTo }: HeroSectionProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '#2563eb'

  return (
    <section id="hero" className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
      {/* Background */}
      {website?.heroImage ? (
        <div className="absolute inset-0">
          <img src={website.heroImage} alt={tenant.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/55" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-slate-900" />
      )}

      {/* Content */}
      <div className="relative z-10 text-center text-white max-w-3xl mx-auto px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/50 mb-6">
          {tenant.name}
        </p>
        <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
          {website?.heroTitle || tenant.name}
        </h1>
        {website?.heroSubtitle && (
          <p className="text-lg md:text-xl text-white/70 mb-10 max-w-xl mx-auto leading-relaxed">
            {website.heroSubtitle}
          </p>
        )}
        <button
          onClick={() => scrollTo('availability')}
          className="inline-flex items-center gap-2 px-8 py-4 text-sm font-semibold tracking-wide rounded-sm text-white transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: primary }}>
          Check Availability
        </button>
      </div>

      {/* Scroll indicator */}
      <button
        onClick={() => scrollTo('about')}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 hover:text-white/60 transition-colors animate-bounce">
        <ArrowDown className="h-6 w-6" />
      </button>
    </section>
  )
}
