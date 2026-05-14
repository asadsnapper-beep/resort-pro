'use client'
import { Bed, Users } from 'lucide-react'
import type { ResortData, ResortRoom } from '../../types'
import { fmt, AmenityIcon } from '../utils'

interface RoomsSectionProps {
  data: ResortData
  onViewRoom:  (room: ResortRoom) => void
  onBookRoom:  (room: ResortRoom) => void
}

export function RoomsSection({ data, onViewRoom, onBookRoom }: RoomsSectionProps) {
  const { tenant, website, rooms } = data
  const primary = website?.primaryColor || '#1a6b5e'
  const accent  = website?.accentColor  || '#d4a853'

  return (
    <section id="rooms" className="py-24" style={{ backgroundColor: `${primary}05` }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>
            Accommodations
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900">Rooms &amp; Villas</h2>
          <p className="mt-4 text-gray-500 max-w-xl mx-auto">
            Each space is designed to offer the perfect blend of luxury and comfort
          </p>
        </div>

        {rooms.length === 0 ? (
          <div className="text-center py-16 text-gray-400">Rooms coming soon</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {rooms.map((room) => (
              <div
                key={room.id}
                onClick={() => onViewRoom(room)}
                className="group bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
              >
                {/* Image */}
                <div className="relative h-56 overflow-hidden">
                  {room.images[0] ? (
                    <img src={room.images[0]} alt={room.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"
                      style={{ backgroundColor: `${primary}15` }}>
                      <Bed className="h-12 w-12 opacity-30" style={{ color: primary }} />
                    </div>
                  )}

                  {/* Room type badge */}
                  <div className="absolute top-4 left-4">
                    <span className="text-xs font-semibold text-white px-3 py-1 rounded-full backdrop-blur-sm"
                      style={{ backgroundColor: `${primary}CC` }}>
                      {room.type.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Media count badge */}
                  {room.images.length > 0 && (
                    <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full">
                      📷 {room.images.length}
                      {(room.videos?.length ?? 0) > 0 && <> · 🎬 {room.videos.length}</>}
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 bg-white/90 backdrop-blur-sm text-gray-900 text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
                      View Details
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{room.name}</h3>
                  {room.description && (
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">{room.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" /> {room.maxOccupancy} guests
                    </span>
                  </div>

                  {room.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {room.amenities.slice(0, 4).map(a => (
                        <span key={a}
                          className="inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1"
                          style={{ backgroundColor: `${primary}10`, color: primary }}>
                          <AmenityIcon amenity={a} /> {a}
                        </span>
                      ))}
                      {room.amenities.length > 4 && (
                        <span className="text-xs text-gray-400">+{room.amenities.length - 4} more</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div>
                      <span className="text-2xl font-bold" style={{ color: primary }}>
                        {fmt(Number(room.basePrice), tenant.currency)}
                      </span>
                      <span className="text-sm text-gray-400"> / night</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onViewRoom(room); }}
                        className="px-4 py-2.5 rounded-full text-sm font-semibold border-2 transition-all hover:bg-gray-50"
                        style={{ borderColor: primary, color: primary }}>
                        Details
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onBookRoom(room); }}
                        className="px-4 py-2.5 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90 hover:scale-105"
                        style={{ backgroundColor: primary }}>
                        Book
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
