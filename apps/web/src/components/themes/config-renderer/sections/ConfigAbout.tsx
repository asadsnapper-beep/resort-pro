'use client'
import type { ResortData } from '../../types'
import type { ThemeConfig } from '../config-types'
import { aboutImg } from '../../_utils/images'

interface Props {
  data:   ResortData
  config: ThemeConfig
}

export function ConfigAbout({ data, config }: Props) {
  const { tenant, website } = data
  const { colors, fonts, about } = config
  const accent      = website?.accentColor  || colors.accent
  const headingFont = fonts.heading === 'serif' ? 'Georgia, Cambria, serif' : 'inherit'
  const layout      = about?.layout || 'image-right'

  const TextBlock = (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.4em] mb-5" style={{ color: accent }}>
        Our Story
      </p>
      <h2
        className="text-4xl md:text-5xl font-bold mb-6 leading-tight"
        style={{ fontFamily: headingFont, color: colors.text }}
      >
        {website?.aboutTitle || `Welcome to ${tenant.name}`}
      </h2>
      <p className="leading-relaxed mb-8 text-lg" style={{ color: colors.textMuted }}>
        {website?.aboutText || 'Discover a place where comfort meets natural beauty.'}
      </p>
      {about?.showBullets && about.bullets && (
        <ul className="space-y-3">
          {about.bullets.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className="mt-1.5 h-3 w-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: accent }}
              />
              <span className="text-sm leading-relaxed" style={{ color: colors.textMuted }}>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  const ImageBlock = (
    <div className="relative flex items-center justify-center">
      <div
        className="absolute -bottom-4 -right-4 w-full h-full rounded-3xl opacity-20"
        style={{ backgroundColor: accent }}
      />
      <div className="relative rounded-3xl overflow-hidden shadow-2xl w-full max-w-md">
        <img
          src={aboutImg(website?.aboutImage)}
          alt="About"
          className="w-full h-80 object-cover"
        />
      </div>
    </div>
  )

  if (layout === 'centered') {
    return (
      <section id="about" className="py-24" style={{ backgroundColor: colors.background }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.4em] mb-5" style={{ color: accent }}>
            Our Story
          </p>
          <h2
            className="text-4xl font-bold mb-6"
            style={{ fontFamily: headingFont, color: colors.text }}
          >
            {website?.aboutTitle || `Welcome to ${tenant.name}`}
          </h2>
          <p className="leading-relaxed text-lg mb-10" style={{ color: colors.textMuted }}>
            {website?.aboutText || 'Discover a place where comfort meets natural beauty.'}
          </p>
          <div className="rounded-3xl overflow-hidden shadow-2xl max-w-2xl mx-auto">
            <img
              src={aboutImg(website?.aboutImage)}
              alt="About"
              className="w-full h-72 object-cover"
            />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="about" className="py-24" style={{ backgroundColor: colors.background }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {layout === 'image-left'
            ? <>{ImageBlock}{TextBlock}</>
            : <>{TextBlock}{ImageBlock}</>
          }
        </div>
      </div>
    </section>
  )
}
