'use client'
import { BookingForm } from '../../_widgets'
import type { ResortData } from '../../types'

interface BookingSectionProps {
  data:              ResortData
  initialCheckIn?:   string
  initialCheckOut?:  string
  initialRoomId?:    string
  initialPromoCode?: string
}

export function BookingSection({
  data, initialCheckIn, initialCheckOut, initialRoomId, initialPromoCode,
}: BookingSectionProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '#1a6b2a'
  const accent  = website?.accentColor  || '#d3d558'

  return (
    <section id="booking" className="py-24" style={{ backgroundColor: '#f2f8f3' }}>
      <div className="max-w-3xl mx-auto px-6">

        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.4em] mb-4" style={{ color: accent }}>
            Reserve Your Stay
          </p>
          <h2 className="font-serif text-4xl font-bold" style={{ color: '#0d2e14' }}>
            Book Your Garden Escape
          </h2>
          <p className="mt-3 text-slate-500">
            Complete your reservation — we'll confirm within 24 hours
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-10">
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
