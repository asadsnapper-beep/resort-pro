'use client'
import { Star } from 'lucide-react'
import type { ResortData } from '../../types'

interface TestimonialsSectionProps {
  data: ResortData
}

export function TestimonialsSection({ data }: TestimonialsSectionProps) {
  const { website } = data
  const primary = website?.primaryColor || '#1a6b5e'
  const accent  = website?.accentColor  || '#d4a853'
  const testimonials = website?.testimonials ?? []

  if (testimonials.length === 0) return null

  return (
    <section className="py-24" style={{ backgroundColor: `${primary}05` }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>
            Reviews
          </p>
          <h2 className="text-4xl font-bold text-gray-900">Guest Experiences</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-white rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, j) => (
                  <Star
                    key={j}
                    className={`h-4 w-4 ${j < t.rating ? 'fill-current' : 'text-gray-200'}`}
                    style={{ color: j < t.rating ? accent : undefined }}
                  />
                ))}
              </div>
              <p className="text-gray-600 italic leading-relaxed mb-5">"{t.text}"</p>
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
                <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
