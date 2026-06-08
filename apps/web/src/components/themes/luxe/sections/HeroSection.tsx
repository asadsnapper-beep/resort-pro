'use client'
import { ArrowRight, ChevronDown } from 'lucide-react'
import type { ResortData } from '../../types'
import { heroImg } from '../../_utils/images'

interface HeroSectionProps {
  data: ResortData
  scrollTo: (id: string) => void
}

export function HeroSection({ data, scrollTo }: HeroSectionProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '#1a6b5e'
  const accent  = website?.accentColor  || '#d4a853'

  return (
    <section id="hero" className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroImg(website?.heroImage)} alt={website?.heroTitle ?? tenant.name}
          className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
      </div>

      <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-6">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] mb-6 opacity-80" style={{ color: accent }}>
          {tenant.name}
        </p>
        <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">{website?.heroTitle}</h1>
        {website?.heroSubtitle && (
          <p className="text-xl md:text-2xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed">
            {website.heroSubtitle}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={() => scrollTo('booking')}
            className="px-8 py-4 rounded-full font-semibold text-sm tracking-wide transition-all hover:scale-105 shadow-lg"
            style={{ backgroundColor: accent, color: '#1a1a1a' }}>
            Book Your Stay <ArrowRight className="inline h-4 w-4 ml-1" />
          </button>
          <button onClick={() => scrollTo('rooms')}
            className="px-8 py-4 rounded-full font-semibold text-sm tracking-wide border-2 border-white/40 text-white backdrop-blur-sm hover:bg-white/10 transition-all">
            Explore Rooms
          </button>
        </div>
      </div>

      <button onClick={() => scrollTo('about')}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 animate-bounce">
        <ChevronDown className="h-8 w-8" />
      </button>
    </section>
  )
}
