'use client'
import type { ResortData } from '../../types'
import { aboutImg } from '../../_utils/images'

interface AboutSectionProps {
  data: ResortData
}

const HIGHLIGHTS = [
  'Beachfront access and ocean-view accommodations',
  'Award-winning cuisine with fresh local seafood',
  'World-class spa and wellness facilities',
  'Curated water sports and adventure activities',
]

export function AboutSection({ data }: AboutSectionProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '#0891b2'
  const accent  = website?.accentColor  || '#d97706'

  return (
    <section id="about" className="py-24" style={{ backgroundColor: '#ecfeff' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left: text */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] mb-5" style={{ color: accent }}>
              Our Story
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
              {website?.aboutTitle || `Welcome to ${tenant.name}`}
            </h2>
            <p className="text-slate-600 leading-relaxed mb-8 text-lg">
              {website?.aboutText || 'Nestled on a pristine stretch of coastline, we offer an unparalleled escape where the rhythm of the ocean sets the pace of your stay.'}
            </p>

            <ul className="space-y-3">
              {HIGHLIGHTS.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: primary }}>
                    ~
                  </span>
                  <span className="text-slate-600 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: circular image with ring treatment */}
          <div className="flex items-center justify-center">
            <div className="relative">
              {/* Outer decorative ring */}
              <div
                className="absolute -inset-4 rounded-full opacity-20"
                style={{ background: `radial-gradient(circle, ${primary}, transparent 70%)` }}
              />
              {/* Image */}
              <div className="relative h-80 w-80 rounded-full overflow-hidden ring-4 ring-cyan-400 shadow-2xl">
                <img src={aboutImg(website?.aboutImage)} alt="About" className="w-full h-full object-cover" />
              </div>
              {/* Floating badge */}
              <div
                className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full flex items-center justify-center shadow-lg text-2xl"
                style={{ backgroundColor: accent }}>
                🌊
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
