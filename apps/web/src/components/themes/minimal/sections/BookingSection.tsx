'use client'
import { BookingForm } from '../../_widgets'
import type { ResortData } from '../../types'

interface BookingSectionProps {
  data:            ResortData
  initialCheckIn?: string
  initialCheckOut?:string
  initialRoomId?:  string
}

export function BookingSection({ data, initialCheckIn, initialCheckOut, initialRoomId }: BookingSectionProps) {
  const { tenant, website, rooms } = data
  const primary = website?.primaryColor || '#2563eb'

  return (
    <section id="booking" className="py-20 bg-white">
      <div className="max-w-2xl mx-auto px-6">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-4"
            style={{ color: primary }}>
            Reserve
          </p>
          <h2 className="text-4xl font-bold text-slate-900">Book Your Stay</h2>
          <p className="text-slate-500 mt-2 text-sm">
            Check-in {tenant.checkInTime} · Check-out {tenant.checkOutTime}
          </p>
        </div>

        <BookingForm
          slug={tenant.slug}
          primaryColor={primary}
          accentColor={website?.accentColor || '#0f172a'}
          currency={tenant.currency}
          rooms={rooms}
          checkInTime={tenant.checkInTime}
          checkOutTime={tenant.checkOutTime}
          initialCheckIn={initialCheckIn}
          initialCheckOut={initialCheckOut}
          initialRoomId={initialRoomId}
        />
      </div>
    </section>
  )
}
