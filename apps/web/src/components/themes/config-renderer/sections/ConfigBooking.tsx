'use client'
import { BookingForm } from '../../_widgets'
import type { ResortData } from '../../types'
import type { ThemeConfig } from '../config-types'

interface Props {
  data:              ResortData
  config:            ThemeConfig
  initialCheckIn?:   string
  initialCheckOut?:  string
  initialRoomId?:    string
  initialPromoCode?: string
}

export function ConfigBooking({
  data, config, initialCheckIn, initialCheckOut, initialRoomId, initialPromoCode,
}: Props) {
  const { tenant, website } = data
  const { colors, fonts } = config
  const primary     = website?.primaryColor || colors.primary
  const accent      = website?.accentColor  || colors.accent
  const headingFont = fonts.heading === 'serif' ? 'Georgia, Cambria, serif' : 'inherit'

  return (
    <section id="booking" className="py-24" style={{ backgroundColor: colors.surface }}>
      <div className="max-w-3xl mx-auto px-6">

        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.4em] mb-4" style={{ color: accent }}>
            Reserve Your Stay
          </p>
          <h2
            className="text-4xl font-bold"
            style={{ fontFamily: headingFont, color: colors.text }}
          >
            Book Your Experience
          </h2>
          <p className="mt-3 text-sm" style={{ color: colors.textMuted }}>
            Complete your reservation — we'll confirm within 24 hours
          </p>
        </div>

        <div
          className="rounded-3xl shadow-sm border p-6 md:p-10"
          style={{ backgroundColor: colors.background, borderColor: `${primary}15` }}
        >
          <BookingForm
            slug={tenant.slug}
            primaryColor={primary}
            accentColor={accent}
            currency={tenant.currency}
            rooms={data.rooms}
            checkInTime={tenant.checkInTime}
            checkOutTime={tenant.checkOutTime}
            initialCheckIn={initialCheckIn}
            initialCheckOut={initialCheckOut}
            initialRoomId={initialRoomId}
            initialPromoCode={initialPromoCode}
          />
        </div>
      </div>
    </section>
  )
}
