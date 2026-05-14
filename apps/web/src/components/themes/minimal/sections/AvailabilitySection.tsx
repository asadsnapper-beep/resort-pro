'use client'
import { AvailabilityCalendar } from '../../_widgets'
import type { ResortData, ResortRoom } from '../../types'

interface AvailabilitySectionProps {
  data:           ResortData
  onRoomSelect?:  (room: ResortRoom, checkIn: Date, checkOut: Date) => void
}

export function AvailabilitySection({ data, onRoomSelect }: AvailabilitySectionProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '#2563eb'

  return (
    <section id="availability" className="py-20 bg-slate-50">
      <div className="max-w-3xl mx-auto px-6">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-4"
            style={{ color: primary }}>
            Availability
          </p>
          <h2 className="text-4xl font-bold text-slate-900">Check Dates</h2>
          <p className="text-slate-500 mt-2 text-sm">
            Select your dates to see which rooms are available
          </p>
        </div>

        <div className="bg-white rounded-sm border border-slate-200 p-6">
          <AvailabilityCalendar
            slug={tenant.slug}
            primaryColor={primary}
            accentColor={website?.accentColor || '#0f172a'}
            currency={tenant.currency}
            onRoomSelect={onRoomSelect}
          />
        </div>
      </div>
    </section>
  )
}
