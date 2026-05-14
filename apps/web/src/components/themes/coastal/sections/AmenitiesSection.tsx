'use client'
import type { ResortData } from '../../types'

interface AmenitiesSectionProps {
  data: ResortData
}

const AMENITIES = [
  { icon: '🏖️', label: 'Beach Access',     desc: 'Private beachfront directly from the resort' },
  { icon: '🌊', label: 'Ocean View',        desc: 'Panoramic sea views from rooms and common areas' },
  { icon: '🏊', label: 'Infinity Pool',     desc: 'Saltwater infinity pool overlooking the ocean' },
  { icon: '🤿', label: 'Water Sports',      desc: 'Snorkeling, kayaking, paddleboarding & more' },
  { icon: '🧖', label: 'Spa & Wellness',    desc: 'Full-service spa with ocean-inspired treatments' },
  { icon: '🍽️', label: 'Fine Dining',       desc: 'Fresh seafood and international cuisine' },
  { icon: '🚤', label: 'Boat Tours',        desc: 'Guided island-hopping and sunset cruises' },
  { icon: '🌅', label: 'Sunrise Yoga',      desc: 'Daily yoga sessions on the beachfront deck' },
]

export function AmenitiesSection({ data }: AmenitiesSectionProps) {
  const { website } = data
  const primary = website?.primaryColor || '#0891b2'
  const accent  = website?.accentColor  || '#d97706'

  return (
    <section id="amenities" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] mb-4" style={{ color: accent }}>
            Experiences
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900">Resort Amenities</h2>
          <p className="mt-4 text-slate-500 max-w-xl mx-auto">
            Everything you need for the perfect coastal escape, curated for unforgettable moments
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {AMENITIES.map(({ icon, label, desc }) => (
            <div
              key={label}
              className="group p-6 rounded-2xl border border-slate-100 hover:border-transparent hover:shadow-lg transition-all duration-300"
              style={{ ['--hover-bg' as string]: `${primary}08` }}
            >
              <div
                className="h-14 w-14 rounded-2xl flex items-center justify-center text-2xl mb-4 transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${primary}12` }}>
                {icon}
              </div>
              <h3 className="font-bold text-slate-900 mb-1.5">{label}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
