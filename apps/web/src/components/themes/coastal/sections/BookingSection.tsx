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

export function BookingSection({ data, initialCheckIn, initialCheckOut, initialRoomId, initialPromoCode }: BookingSectionProps) {
  const { tenant, website, rooms } = data
  const primary = website?.primaryColor || '#0891b2'
  const accent  = website?.accentColor  || '#d97706'

  return (
    <section id="booking" className="py-0 overflow-hidden">
      <div className="grid lg:grid-cols-2 min-h-[600px]">

        {/* Left: dark teal panel */}
        <div
          className="flex flex-col justify-center px-10 py-20 text-white"
          style={{ backgroundColor: '#164e63' }}>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50 mb-5">
            Reserve
          </p>
          <h2 className="text-4xl font-bold mb-4">Book Your Stay</h2>
          <p className="text-white/70 leading-relaxed mb-8">
            Your perfect coastal getaway awaits. Complete your reservation below and our team
            will reach out to confirm every detail of your stay.
          </p>

          {/* Quick info */}
          <div className="space-y-3 text-sm text-white/60">
            <div className="flex items-center gap-3">
              <span className="text-lg">🕑</span>
              <span>Check-in from {tenant.checkInTime} · Check-out by {tenant.checkOutTime}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg">🏖️</span>
              <span>Complimentary beach access for all guests</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg">✅</span>
              <span>Free cancellation up to 48 hours before arrival</span>
            </div>
          </div>

          {/* Wave decoration */}
          <div className="mt-16 opacity-10">
            <svg viewBox="0 0 400 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
              <path d="M0 30 C80 60 160 0 240 30 C320 60 360 0 400 30" stroke="white" strokeWidth="2" fill="none"/>
              <path d="M0 45 C80 75 160 15 240 45 C320 75 360 15 400 45" stroke="white" strokeWidth="1.5" fill="none" opacity="0.6"/>
            </svg>
          </div>
        </div>

        {/* Right: booking form */}
        <div className="bg-white flex flex-col justify-center px-10 py-16">
          <BookingForm
            slug={tenant.slug}
            primaryColor={primary}
            accentColor={accent}
            currency={tenant.currency}
            rooms={rooms}
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
