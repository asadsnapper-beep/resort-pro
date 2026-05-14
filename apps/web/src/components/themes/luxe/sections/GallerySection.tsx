'use client'
import type { ResortData } from '../../types'

interface GallerySectionProps {
  data: ResortData
}

export function GallerySection({ data }: GallerySectionProps) {
  const { website } = data
  const accent = website?.accentColor || '#d4a853'
  const images = website?.galleryImages ?? []

  if (images.length === 0) return null

  return (
    <section id="gallery" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>
            Gallery
          </p>
          <h2 className="text-4xl font-bold text-gray-900">Visual Journey</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((img, i) => (
            <div key={i} className={`overflow-hidden rounded-2xl ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
              <img
                src={img}
                alt={`Gallery ${i + 1}`}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                style={{ height: i === 0 ? '400px' : '190px' }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
