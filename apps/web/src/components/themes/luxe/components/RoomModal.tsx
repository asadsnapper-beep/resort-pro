'use client'
import { useState, useEffect } from 'react'
import { X, ChevronDown, Bed, Users, CheckCircle, Calendar } from 'lucide-react'
import type { ResortRoom } from '../../types'
import { fmt, AmenityIcon } from '../utils'

const ROOM_TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Standard Room', DELUXE: 'Deluxe Room', SUITE: 'Suite',
  VILLA: 'Villa', PENTHOUSE: 'Penthouse', BUNGALOW: 'Bungalow',
  FAMILY: 'Family Room', TWIN: 'Twin Room',
}

interface RoomModalProps {
  room:         ResortRoom
  currency:     string
  primaryColor: string
  accentColor:  string
  onClose:      () => void
  onBook:       (room: ResortRoom) => void
}

export function RoomModal({ room, currency, primaryColor, accentColor, onClose, onBook }: RoomModalProps) {
  const [activeMedia, setActiveMedia] = useState(0)
  const [mediaType, setMediaType]     = useState<'photo' | 'video'>('photo')

  const allPhotos  = room.images ?? []
  const allVideos  = room.videos ?? []
  const totalPhotos = allPhotos.length
  const hasMedia   = totalPhotos > 0 || allVideos.length > 0

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft'  && mediaType === 'photo' && totalPhotos > 1)
        setActiveMedia(p => (p - 1 + totalPhotos) % totalPhotos)
      if (e.key === 'ArrowRight' && mediaType === 'photo' && totalPhotos > 1)
        setActiveMedia(p => (p + 1) % totalPhotos)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, mediaType, totalPhotos])

  const isYouTube   = (url: string) => url.includes('youtube.com') || url.includes('youtu.be')
  const getYTId     = (url: string) => url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1] ?? ''

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors">
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col lg:flex-row overflow-hidden flex-1 min-h-0">

            {/* ── LEFT: Media Viewer ── */}
            <div className="lg:w-[55%] flex-shrink-0 bg-gray-900 flex flex-col">

              {/* Tabs */}
              {allVideos.length > 0 && (
                <div className="flex gap-1 p-3 bg-black/30">
                  <button
                    onClick={() => setMediaType('photo')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${mediaType === 'photo' ? 'bg-white text-gray-900' : 'text-white/70 hover:text-white'}`}>
                    📷 Photos {totalPhotos > 0 && `(${totalPhotos})`}
                  </button>
                  <button
                    onClick={() => setMediaType('video')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${mediaType === 'video' ? 'bg-white text-gray-900' : 'text-white/70 hover:text-white'}`}>
                    🎬 Videos ({allVideos.length})
                  </button>
                </div>
              )}

              {/* Main media */}
              <div className="relative flex-1 min-h-[250px] lg:min-h-0 overflow-hidden">
                {!hasMedia ? (
                  <div className="w-full h-full flex flex-col items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}30, ${accentColor}30)` }}>
                    <Bed className="h-16 w-16 opacity-20 text-white mb-3" />
                    <p className="text-white/40 text-sm">No photos available</p>
                  </div>
                ) : mediaType === 'photo' && allPhotos.length > 0 ? (
                  <>
                    <img
                      key={activeMedia}
                      src={allPhotos[activeMedia]}
                      alt={`${room.name} — photo ${activeMedia + 1}`}
                      className="w-full h-full object-cover"
                      style={{ animation: 'fadeIn 0.3s ease' }}
                    />
                    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full">
                      {activeMedia + 1} / {totalPhotos}
                    </div>
                    {totalPhotos > 1 && (
                      <>
                        <button
                          onClick={() => setActiveMedia(p => (p - 1 + totalPhotos) % totalPhotos)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-all hover:scale-110">
                          <ChevronDown className="h-5 w-5 rotate-90" />
                        </button>
                        <button
                          onClick={() => setActiveMedia(p => (p + 1) % totalPhotos)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-all hover:scale-110">
                          <ChevronDown className="h-5 w-5 -rotate-90" />
                        </button>
                      </>
                    )}
                  </>
                ) : mediaType === 'video' && allVideos.length > 0 ? (
                  <div className="w-full h-full">
                    {isYouTube(allVideos[0]) ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${getYTId(allVideos[0])}?autoplay=0&rel=0`}
                        className="w-full h-full"
                        frameBorder="0"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    ) : (
                      <video src={allVideos[0]} controls className="w-full h-full object-contain bg-black">
                        Your browser does not support the video tag.
                      </video>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Photo thumbnails */}
              {mediaType === 'photo' && totalPhotos > 1 && (
                <div className="flex gap-2 p-3 bg-black/60 overflow-x-auto">
                  {allPhotos.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveMedia(i)}
                      className={`flex-shrink-0 h-14 w-20 rounded-lg overflow-hidden border-2 transition-all hover:opacity-100 ${activeMedia === i ? 'border-white opacity-100 scale-105' : 'border-transparent opacity-60'}`}>
                      <img src={img} alt={`thumb ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Video thumbnails */}
              {mediaType === 'video' && allVideos.length > 1 && (
                <div className="flex gap-2 p-3 bg-black/60 overflow-x-auto">
                  {allVideos.map((_, i) => (
                    <button key={i}
                      className="flex-shrink-0 h-14 w-20 rounded-lg bg-gray-700 flex items-center justify-center text-white/60 border-2 border-white/30">
                      ▶
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── RIGHT: Details ── */}
            <div className="lg:flex-1 overflow-y-auto">
              <div className="p-6 space-y-5">

                {/* Name + type */}
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-bold text-white px-3 py-1 rounded-full"
                      style={{ backgroundColor: primaryColor }}>
                      {ROOM_TYPE_LABELS[room.type] ?? room.type}
                    </span>
                    {room.floor && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                        Floor {room.floor}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">{room.name}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Room #{room.number}</p>
                </div>

                {/* Price */}
                <div className="flex items-end gap-2 py-3 border-y border-gray-100">
                  <span className="text-3xl font-bold" style={{ color: primaryColor }}>
                    {fmt(Number(room.basePrice), currency)}
                  </span>
                  <span className="text-gray-400 text-sm mb-1">per night</span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Users,       label: 'Max Guests', value: `${room.maxOccupancy} ${room.maxOccupancy === 1 ? 'guest' : 'guests'}` },
                    { icon: Bed,         label: 'Room Type',  value: ROOM_TYPE_LABELS[room.type] ?? room.type },
                    { icon: ChevronDown, label: 'Floor',      value: room.floor ? `Floor ${room.floor}` : 'Ground Floor' },
                    { icon: CheckCircle, label: 'Status',     value: 'Available' },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="rounded-xl p-3" style={{ backgroundColor: `${primaryColor}08` }}>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                        <Icon className="h-3.5 w-3.5" /> {label}
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Description */}
                {room.description && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">About this room</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">{room.description}</p>
                  </div>
                )}

                {/* Amenities */}
                {room.amenities.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Amenities</h4>
                    <div className="flex flex-wrap gap-2">
                      {room.amenities.map(amenity => (
                        <span key={amenity}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border"
                          style={{ borderColor: `${primaryColor}40`, color: primaryColor, backgroundColor: `${primaryColor}08` }}>
                          <AmenityIcon amenity={amenity} />
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Policies */}
                <div className="rounded-xl bg-gray-50 p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700">Room Policies</h4>
                  <div className="grid grid-cols-2 gap-y-1.5 text-xs text-gray-500">
                    <span>✓ Free cancellation (48h)</span>
                    <span>✓ Complimentary Wi-Fi</span>
                    <span>✓ Daily housekeeping</span>
                    <span>✓ 24/7 room service</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer CTA */}
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-t bg-white">
            <div>
              <p className="text-xs text-gray-400">Starting from</p>
              <p className="text-xl font-bold" style={{ color: primaryColor }}>
                {fmt(Number(room.basePrice), currency)}
                <span className="text-sm font-normal text-gray-400"> / night</span>
              </p>
            </div>
            <button
              onClick={() => { onBook(room); onClose(); }}
              className="flex items-center gap-2 px-8 py-3.5 rounded-full font-semibold text-sm transition-all hover:opacity-90 hover:scale-105 shadow-lg"
              style={{ backgroundColor: accentColor, color: '#1a1a1a' }}>
              <Calendar className="h-4 w-4" />
              Book This Room
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
