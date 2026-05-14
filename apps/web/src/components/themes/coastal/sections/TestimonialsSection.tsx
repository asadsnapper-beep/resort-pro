'use client'
import type { ResortData } from '../../types'

interface TestimonialsSectionProps {
  data: ResortData
}

export function TestimonialsSection({ data }: TestimonialsSectionProps) {
  const { website } = data
  const primary      = website?.primaryColor || '#0891b2'
  const accent       = website?.accentColor  || '#d97706'
  const testimonials = website?.testimonials ?? []

  if (testimonials.length === 0) return null

  return (
    <section className="py-24" style={{ backgroundColor: '#ecfeff' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] mb-4" style={{ color: accent }}>
            Stories
          </p>
          <h2 className="text-4xl font-bold text-slate-900">Guest Voices</h2>
        </div>

        {/* Horizontal scroll on mobile, grid on desktop */}
        <div className="flex gap-6 overflow-x-auto pb-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible snap-x snap-mandatory">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-80 md:w-auto snap-start bg-white rounded-3xl p-7 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Quote icon */}
              <div className="mb-4">
                <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
                  <path d="M13 0H0v13h6.5C6.5 17 4 20.5 0 24h4C10 20 13 15 13 10V0zM32 0H19v13h6.5C25.5 17 23 20.5 19 24h4c6-4 9-9 9-14V0z"
                    fill={primary} fillOpacity="0.2" />
                </svg>
              </div>

              {/* Stars */}
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, j) => (
                  <span key={j} className="text-sm" style={{ color: j < t.rating ? accent : '#e2e8f0' }}>
                    ★
                  </span>
                ))}
              </div>

              <p className="text-slate-600 leading-relaxed mb-6 italic">"{t.text}"</p>

              <div className="flex items-center gap-3">
                {t.avatar ? (
                  <img src={t.avatar} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: primary }}>
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
