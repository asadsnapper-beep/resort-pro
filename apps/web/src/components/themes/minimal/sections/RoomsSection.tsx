'use client'
import { Users } from 'lucide-react'
import type { ResortData, ResortRoom } from '../../types'
import { roomImg } from '../../_utils/images'

interface RoomsSectionProps {
  data:       ResortData
  onBookRoom: (room: ResortRoom) => void
}

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

export function RoomsSection({ data, onBookRoom }: RoomsSectionProps) {
  const { tenant, website, rooms } = data
  const primary = website?.primaryColor || '#2563eb'

  return (
    <section id="rooms" className="py-20 bg-slate-50">
      <div className="max-w-5xl mx-auto px-6">

        {/* Header */}
        <div className="mb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-4"
            style={{ color: primary }}>
            Accommodations
          </p>
          <h2 className="text-4xl font-bold text-slate-900">Rooms &amp; Suites</h2>
        </div>

        {rooms.length === 0 ? (
          <p className="text-slate-400 py-12">Rooms coming soon.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {rooms.map(room => (
              <RoomRow
                key={room.id}
                room={room}
                currency={tenant.currency}
                primary={primary}
                onBook={() => onBookRoom(room)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function RoomRow({ room, currency, primary, onBook }: {
  room:     ResortRoom
  currency: string
  primary:  string
  onBook:   () => void
}) {
  return (
    <div className="flex gap-6 py-8 group">
      {/* Thumbnail */}
      <div className="flex-shrink-0 w-48 h-32 overflow-hidden rounded-sm bg-slate-100">
        <img
          src={roomImg(room.images[0])}
          alt={room.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">{room.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-wide">
                {room.type.replace('_', ' ')}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xl font-bold" style={{ color: primary }}>
                {fmt(Number(room.basePrice), currency)}
              </p>
              <p className="text-xs text-slate-400">/ night</p>
            </div>
          </div>

          {room.description && (
            <p className="text-sm text-slate-500 mt-2 leading-relaxed line-clamp-2">
              {room.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mt-4">
          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> {room.maxOccupancy} guests
            </span>
            {room.amenities.slice(0, 3).map(a => (
              <span key={a} className="hidden sm:inline px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                {a}
              </span>
            ))}
            {room.amenities.length > 3 && (
              <span className="text-slate-400">+{room.amenities.length - 3} more</span>
            )}
          </div>

          <button
            onClick={onBook}
            className="text-sm font-semibold px-5 py-2 rounded-sm transition-all hover:opacity-90 text-white"
            style={{ backgroundColor: primary }}>
            Book
          </button>
        </div>
      </div>
    </div>
  )
}
