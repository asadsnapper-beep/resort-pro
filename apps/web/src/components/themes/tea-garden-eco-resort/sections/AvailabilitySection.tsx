'use client'
import { AvailabilityCalendar } from '../../_widgets'
import type { ResortData, ResortRoom } from '../../types'

interface AvailabilitySectionProps {
  data:          ResortData
  onRoomSelect?: (room: ResortRoom, checkIn: Date, checkOut: Date) => void
}

export function AvailabilitySection({ data, onRoomSelect }: AvailabilitySectionProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '#1a6b2a'
  const accent  = website?.accentColor  || '#d3d558'

  return (
    <section id="availability" className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-6">

        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.4em] mb-4" style={{ color: accent }}>
            Plan Your Visit
          </p>
          <h2 className="font-serif text-4xl font-bold" style={{ color: '#0d2e14' }}>
            Check Availability
          </h2>
          <p className="mt-3 text-slate-500">
            Select your dates and find your perfect hillside retreat
          </p>
        </div>

        <div
          className="rounded-3xl shadow-sm p-6 md:p-8 border"
          style={{ borderColor: `${primary}20`, backgroundColor: '#fafffe' }}
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
