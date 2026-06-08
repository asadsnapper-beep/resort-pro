'use client'
import type { ResortData, ResortRoom } from '../../types'
import type { ThemeConfig } from '../config-types'
import { roomImg } from '../../_utils/images'

interface Props {
  data:         ResortData
  config:       ThemeConfig
  onBookRoom?:  (room: ResortRoom) => void
}

export function ConfigRooms({ data, config, onBookRoom }: Props) {
  const { colors, fonts, rooms: roomConfig } = config
  const primary     = data.website?.primaryColor || colors.primary
  const accent      = data.website?.accentColor  || colors.accent
  const headingFont = fonts.heading === 'serif' ? 'Georgia, Cambria, serif' : 'inherit'
  const cardBg      = roomConfig?.cardBackground || colors.surface

  if (!data.rooms.length) return null

  return (
    <section id="rooms" className="py-24" style={{ backgroundColor: colors.surface }}>
      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-[0.4em] mb-4" style={{ color: accent }}>
            Accommodation
          </p>
          <h2 className="text-4xl font-bold" style={{ fontFamily: headingFont, color: colors.text }}>
            Our Rooms & Suites
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.rooms.map((room, i) => (
            <div
              key={room.id}
              className="overflow-hidden rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              style={{ backgroundColor: cardBg }}
            >
              <div className="relative overflow-hidden h-52">
                <img
                  src={roomImg(room.images[0], i)}
                  alt={room.name}
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                />
                <span
                  className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full text-white"
                  style={{ backgroundColor: primary }}
                >
                  {room.type}
                </span>
              </div>
              <div className="p-5">
                <h3
                  className="font-bold text-lg mb-1"
                  style={{ fontFamily: headingFont, color: colors.text }}
                >
                  {room.name}
                </h3>
                <p className="text-sm mb-4" style={{ color: colors.textMuted }}>
                  Up to {room.maxOccupancy} guests · {room.amenities.slice(0, 3).join(' · ')}
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xl font-bold" style={{ color: primary }}>
                      {data.tenant.currency} {room.basePrice.toLocaleString()}
                    </span>
                    <span className="text-xs ml-1" style={{ color: colors.textMuted }}>/night</span>
                  </div>
                  <button
                    onClick={() => onBookRoom?.(room)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-85"
                    style={{ backgroundColor: accent }}
                  >
                    {roomConfig?.ctaLabel || 'Book Now'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
