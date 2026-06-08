'use client'
import type { ResortData } from '../../types'
import { galleryImg } from '../../_utils/images'

interface GallerySectionProps {
  data: ResortData
}

const CAPTIONS = [
  'Tea Garden Views', 'Morning Mist', 'Garden Walks', 'Eco Cottages',
  'Valley Sunrise', 'Organic Dining', 'Garden Plucking', 'Hilltop Retreat',
]

export function GallerySection({ data }: GallerySectionProps) {
  const { website } = data
  const primary  = website?.primaryColor || '#1a6b2a'
  const accent   = website?.accentColor  || '#d3d558'
  const rawImages = website?.galleryImages ?? []
  const images = rawImages.length > 0
    ? rawImages
    : Array.from({ length: 8 }, (_, i) => galleryImg(undefined, i))

  return (
    <section id="gallery" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-[0.4em] mb-4" style={{ color: accent }}>
            Gallery
          </p>
          <h2 className="font-serif text-4xl font-bold" style={{ color: '#0d2e14' }}>
            Life in the Garden
          </h2>
          <p className="mt-3 text-slate-500">Moments of tranquility from our hilltop haven</p>
        </div>

        {/* Masonry-style grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map((imgUrl, i) => {
            const isFeature = i === 0
            const isWide    = i === 5
            return (
              <div
                key={i}
                className={`group overflow-hidden rounded-2xl relative ${
                  isFeature ? 'col-span-2 row-span-2' : isWide ? 'col-span-2' : ''
                }`}
              >
                <img
                  src={imgUrl}
                  alt={CAPTIONS[i % 8]}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  style={{ height: isFeature ? '440px' : '210px' }}
                />
                {/* Hover overlay */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4"
                  style={{ background: `linear-gradient(to top, ${primary}cc, transparent)` }}
                >
                  <span className="text-white text-xs font-semibold tracking-wide">
                    {CAPTIONS[i % 8]}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
