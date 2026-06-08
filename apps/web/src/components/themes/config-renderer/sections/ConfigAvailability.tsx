'use client'
import { AvailabilityCalendar } from '../../_widgets'
import type { ResortData, ResortRoom } from '../../types'
import type { ThemeConfig } from '../config-types'

interface Props {
  data:          ResortData
  config:        ThemeConfig
  onRoomSelect?: (room: ResortRoom, checkIn: Date, checkOut: Date) => void
}

export function ConfigAvailability({ data, config, onRoomSelect }: Props) {
  const { tenant, website } = data
  const { colors, fonts } = config
  const primary     = website?.primaryColor || colors.primary
  const accent      = website?.accentColor  || colors.accent
  const headingFont = fonts.heading === 'serif' ? 'Georgia, Cambria, serif' : 'inherit'

  return (
    <section id="availability" className="py-24" style={{ backgroundColor: colors.background }}>
      <div className="max-w-4xl mx-auto px-6">

        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.4em] mb-4" style={{ color: accent }}>
            Plan Your Visit
          </p>
          <h2
            className="text-4xl font-bold"
            style={{ fontFamily: headingFont, color: colors.text }}
          >
            Check Availability
          </h2>
          <p className="mt-3 text-sm" style={{ color: colors.textMuted }}>
            Select your dates and find your perfect room
          </p>
        </div>

        <div
          className="rounded-3xl shadow-sm p-6 md:p-8 border"
          style={{ borderColor: `${primary}20`, backgroundColor: colors.surface }}
        >
          <AvailabilityCalendar
            slug={tenant.slug}
            primaryColor={primary}
            accentColor={accent}
            currency={tenant.currency}
            onRoomSelect={onRoomSelect}
          />
        </div>
      </div>
    </section>
  )
}
