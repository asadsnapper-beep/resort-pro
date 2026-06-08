'use client'
import type { ResortData } from '../../types'
import type { ThemeConfig } from '../config-types'
import { avatarImg } from '../../_utils/images'

interface Props {
  data:   ResortData
  config: ThemeConfig
}

export function ConfigTestimonials({ data, config }: Props) {
  const { colors, fonts } = config
  const accent       = data.website?.accentColor || colors.accent
  const headingFont  = fonts.heading === 'serif' ? 'Georgia, Cambria, serif' : 'inherit'
  const testimonials = data.website?.testimonials ?? []

  if (!testimonials.length) return null

  return (
    <section id="testimonials" className="py-24" style={{ backgroundColor: colors.surface }}>
      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-[0.4em] mb-4" style={{ color: accent }}>
            Guest Reviews
          </p>
          <h2 className="text-4xl font-bold" style={{ fontFamily: headingFont, color: colors.text }}>
            What Our Guests Say
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="p-8 rounded-3xl shadow-sm"
              style={{ backgroundColor: colors.background }}
            >
              <p
                className="text-5xl font-serif mb-4 leading-none select-none"
                style={{ color: accent, fontFamily: 'Georgia, serif' }}
              >
                "
              </p>
              <p className="text-sm leading-relaxed mb-6" style={{ color: colors.textMuted }}>
                {t.text}
              </p>
              <div className="flex items-center gap-3">
                <img
                  src={avatarImg(t.avatar, i)}
                  alt={t.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <p className="font-semibold text-sm" style={{ color: colors.text }}>{t.name}</p>
                  <p className="text-xs" style={{ color: accent }}>
                    {'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
