'use client'
import { AvailabilityCalendar } from '../../_widgets'
import type { ResortData, ResortRoom } from '../../types'

interface AvailabilitySectionProps {
  data:          ResortData
  onRoomSelect?: (room: ResortRoom, checkIn: Date, checkOut: Date) => void
}

export function AvailabilitySection({ data, onRoomSelect }: AvailabilitySectionProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '#0891b2'
  const accent  = website?.accentColor  || '#d97706'

  return (
    <section id="availability" className="py-24" style={{ background: 'linear-gradient(to bottom, #ecfeff, #ffffff)' }}>
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] mb-4" style={{ color: accent }}>
            Plan Your Escape
          </p>
          <h2 className="text-4xl font-bold text-slate-900">Check Availability</h2>
          <p className="mt-3 text-slate-500">
            Select your ideal dates to see available rooms and suites
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-cyan-100 p-6 md:p-8">
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
