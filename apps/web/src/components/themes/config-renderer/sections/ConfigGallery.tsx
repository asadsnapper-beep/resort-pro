'use client'
import type { ResortData } from '../../types'
import type { ThemeConfig } from '../config-types'
import { galleryImg } from '../../_utils/images'

interface Props {
  data:   ResortData
  config: ThemeConfig
}

const FALLBACK_CAPTIONS = ['Resort View', 'Accommodation', 'Dining', 'Leisure', 'Nature', 'Sunset', 'Pool', 'Garden']

export function ConfigGallery({ data, config }: Props) {
  const { colors, fonts, gallery } = config
  const accent      = data.website?.accentColor  || colors.accent
  const primary     = data.website?.primaryColor || colors.primary
  const headingFont = fonts.heading === 'serif' ? 'Georgia, Cambria, serif' : 'inherit'
  const layout      = gallery?.layout   || 'masonry'
  const captions    = gallery?.captions || FALLBACK_CAPTIONS

  const rawImages = data.website?.galleryImages ?? []
  const images    = rawImages.length > 0
    ? rawImages
    : Array.from({ length: 8 }, (_, i) => galleryImg(undefined, i))

  return (
    <section id="gallery" className="py-24" style={{ backgroundColor: colors.background }}>
      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-[0.4em] mb-4" style={{ color: accent }}>
            Gallery
          </p>
          <h2 className="text-4xl font-bold" style={{ fontFamily: headingFont, color: colors.text }}>
            Experience the Beauty
          </h2>
        </div>

        {layout === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((imgUrl, i) => (
              <div key={i} className="group overflow-hidden rounded-2xl relative" style={{ aspectRatio: '1' }}>
                <img
                  src={imgUrl}
                  alt={captions[i % captions.length]}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3"
                  style={{ background: `linear-gradient(to top, ${primary}cc, transparent)` }}
                >
                  <span className="text-white text-xs font-semibold">{captions[i % captions.length]}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // masonry-style
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
                    alt={captions[i % captions.length]}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{ height: isFeature ? '440px' : '210px' }}
                  />
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4"
                    style={{ background: `linear-gradient(to top, ${primary}cc, transparent)` }}
                  >
                    <span className="text-white text-xs font-semibold tracking-wide">
                      {captions[i % captions.length]}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
