'use client'
import type { ResortData } from '../../types'
import { aboutImg } from '../../_utils/images'

interface AboutSectionProps {
  data: ResortData
}

const HIGHLIGHTS = [
  'Nestled amidst lush tea gardens and misty hillsides',
  'Organic farm-to-table dining with estate-grown produce',
  'Eco-friendly cottages with panoramic valley views',
  'Guided tea garden walks and traditional plucking experiences',
]

export function AboutSection({ data }: AboutSectionProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '#1a6b2a'
  const accent  = website?.accentColor  || '#d3d558'

  return (
    <section id="about" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left: text */}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.4em] mb-5" style={{ color: accent }}>
              Our Story
            </p>
            <h2
              className="font-serif text-4xl md:text-5xl font-bold mb-6 leading-tight"
              style={{ color: '#0d2e14' }}
            >
              {website?.aboutTitle || `Welcome to ${tenant.name}`}
            </h2>
            <p className="text-slate-600 leading-relaxed mb-8 text-lg">
              {website?.aboutText ||
                'Tucked away in the verdant hills, our eco resort is a sanctuary where rolling tea gardens meet crisp mountain air. A place to slow down, breathe deep, and reconnect with nature.'}
            </p>

            <ul className="space-y-3.5">
              {HIGHLIGHTS.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="mt-1 flex-shrink-0 h-4 w-4 rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                  <span className="text-slate-600 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: image with decorative frame */}
          <div className="flex items-center justify-center">
            <div className="relative">
              {/* Offset decorative box */}
              <div
                className="absolute -bottom-4 -right-4 w-full h-full rounded-3xl"
                style={{ backgroundColor: `${accent}30` }}
              />
              {/* Main image */}
              <div className="relative rounded-3xl overflow-hidden shadow-2xl w-full max-w-md">
                <img
                  src={aboutImg(website?.aboutImage)}
                  alt="About"
                  className="w-full h-80 object-cover"
                />
                {/* Green tint at bottom */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-24"
                  style={{ background: `linear-gradient(to top, ${primary}90, transparent)` }}
                />
              </div>
              {/* Floating badge */}
              <div
                className="absolute -top-4 -left-4 h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg text-2xl rotate-6"
                style={{ backgroundColor: primary }}
              >
                🌿
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
