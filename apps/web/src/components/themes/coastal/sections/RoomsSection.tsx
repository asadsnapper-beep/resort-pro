'use client'
import { Users } from 'lucide-react'
import type { ResortData, ResortRoom } from '../../types'
import { roomImg } from '../../_utils/images'
import type { PublicOffer } from '../../_widgets/OffersWidget'
import { getBestOfferForRoom } from '../../_widgets/OffersWidget'

interface RoomsSectionProps {
  data:        ResortData
  offers?:     PublicOffer[]
  onViewRoom:  (room: ResortRoom) => void
  onBookRoom:  (room: ResortRoom) => void
}

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

export function RoomsSection({ data, offers = [], onViewRoom, onBookRoom }: RoomsSectionProps) {
  const { tenant, website, rooms } = data
  const primary = website?.primaryColor || '#0891b2'
  const accent  = website?.accentColor  || '#d97706'

  return (
    <section id="rooms" className="py-24" style={{ backgroundColor: '#ecfeff' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] mb-4" style={{ color: accent }}>
            Stay With Us
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900">Rooms &amp; Villas</h2>
          <p className="mt-4 text-slate-500 max-w-xl mx-auto">
            Each space is a sanctuary designed with the ocean in mind
          </p>
        </div>

        {rooms.length === 0 ? (
          <div className="text-center py-16 text-slate-400">Rooms coming soon</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {rooms.map(room => (
              <RoomCard
                key={room.id}
                room={room}
                currency={tenant.currency}
                primary={primary}
                accent={accent}
                offer={getBestOfferForRoom(room.id, offers)}
                onView={() => onViewRoom(room)}
                onBook={() => onBookRoom(room)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function RoomCard({ room, currency, primary, accent, offer, onView, onBook }: {
  room:     ResortRoom
  currency: string
  primary:  string
  accent:   string
  offer?:   PublicOffer | null
  onView:   () => void
  onBook:   () => void
}) {
  const offerLabel = offer
    ? offer.type === 'PERCENTAGE' ? `${offer.value}% OFF`
    : offer.type === 'FIXED'     ? `$${offer.value} OFF`
    : `${offer.value} FREE NIGHT${offer.value > 1 ? 'S' : ''}`
    : null

  return (
    <div
      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer"
      onClick={onView}
    >
      {/* Image */}
      <div className="relative h-52 overflow-hidden">
        <img
          src={roomImg(room.images[0])}
          alt={room.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Room type badge */}
        <div className="absolute top-3 left-3">
          <span className="text-xs font-semibold text-white px-3 py-1 rounded-full"
            style={{ backgroundColor: primary }}>
            {room.type.replace('_', ' ')}
          </span>
        </div>
        {/* Offer badge */}
        {offerLabel && (
          <div className="absolute bottom-3 left-3">
            <span className="text-xs font-bold text-white px-3 py-1 rounded-full animate-pulse"
              style={{ backgroundColor: accent }}>
              🏷 {offerLabel}
            </span>
          </div>
        )}
        {/* Price tag */}
        <div className="absolute top-3 right-3">
          <span className="text-xs font-bold px-3 py-1 rounded-full text-white"
            style={{ backgroundColor: accent }}>
            From {fmt(Number(room.basePrice), currency)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        <h3 className="font-bold text-slate-900 text-lg mb-1">{room.name}</h3>
        {room.description && (
          <p className="text-sm text-slate-500 mb-3 line-clamp-2 leading-relaxed">{room.description}</p>
        )}

        <div className="flex items-center gap-3 text-xs text-slate-400 mb-4">
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {room.maxOccupancy} guests</span>
          {room.amenities.slice(0, 2).map(a => (
            <span key={a} className="px-2 py-0.5 rounded-full" style={{ backgroundColor: `${primary}12`, color: primary }}>
              {a}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div>
            <span className="text-xl font-bold" style={{ color: primary }}>
              {fmt(Number(room.basePrice), currency)}
            </span>
            <span className="text-xs text-slate-400"> / night</span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onBook(); }}
            className="px-5 py-2 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90 hover:scale-105"
            style={{ backgroundColor: primary }}>
            Book Now
          </button>
        </div>
      </div>
    </div>
  )
}
