'use client'
import type { ResortData } from '../../types'

interface TestimonialsSectionProps {
  data: ResortData
}

export function TestimonialsSection({ data }: TestimonialsSectionProps) {
  const { website } = data
  const primary      = website?.primaryColor || '#1a6b2a'
  const accent       = website?.accentColor  || '#d3d558'
  const testimonials = website?.testimonials ?? []

  if (testimonials.length === 0) return null

  return (
    <section className="py-24" style={{ backgroundColor: '#f2f8f3' }}>
      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-[0.4em] mb-4" style={{ color: accent }}>
            Guest Stories
          </p>
          <h2 className="font-serif text-4xl font-bold" style={{ color: '#0d2e14' }}>
            Voices from the Garden
          </h2>
        </div>

        <div className="flex gap-6 overflow-x-auto pb-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible snap-x snap-mandatory">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-80 md:w-auto snap-start bg-white rounded-3xl p-7 shadow-sm hover:shadow-md transition-shadow border border-slate-100"
            >
              {/* Large serif quote */}
              <p
                className="font-serif text-6xl leading-none mb-2 -mt-2"
                style={{ color: accent }}
              >
                "
              </p>

              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, j) => (
                  <span key={j} style={{ color: j < t.rating ? accent : '#e2e8f0' }}>★</span>
                ))}
              </div>

              <p className="text-slate-600 leading-relaxed mb-6 text-sm italic">
                {t.text}
              </p>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                {t.avatar ? (
                  <img src={t.avatar} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: primary }}
                  >
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="font-semibold text-slate-800 text-sm">{t.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
