'use client'
import type { ResortData } from '../../types'
import { galleryImg } from '../../_utils/images'

interface GallerySectionProps {
  data: ResortData
}

const FALLBACK_COUNT = 8
const CAPTIONS = ['Beachfront', 'Poolside', 'Ocean View', 'Dining', 'Spa', 'Water Sports', 'Sunset', 'Rooms']

export function GallerySection({ data }: GallerySectionProps) {
  const { website } = data
  const accent  = website?.accentColor  || '#d97706'
  const primary = website?.primaryColor || '#0891b2'
  const rawImages = website?.galleryImages ?? []
  const images = rawImages.length > 0
    ? rawImages
    : Array.from({ length: FALLBACK_COUNT }, (_, i) => galleryImg(undefined, i))

  return (
    <section id="gallery" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] mb-4" style={{ color: accent }}>
            Moments
          </p>
          <h2 className="text-4xl font-bold text-slate-900">Life at the Coast</h2>
        </div>

        {/* Masonry-style grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map((img, i) => {
            // First image: spans 2 cols + 2 rows; 5th image: spans 2 cols
            const isFeature = i === 0
            const isWide    = i === 4
            return (
              <div
                key={i}
                className={`group overflow-hidden rounded-2xl relative ${
                  isFeature ? 'col-span-2 row-span-2' : isWide ? 'col-span-2' : ''
                }`}
              >
                <img
                  src={img}
                  alt={`Gallery ${i + 1}`}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  style={{ height: isFeature ? '420px' : isWide ? '200px' : '200px' }}
                />
                {/* Hover caption overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                  <span className="text-white text-xs font-medium">
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
