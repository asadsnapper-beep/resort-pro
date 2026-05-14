'use client'
import { Star } from 'lucide-react'
import type { ResortData } from '../../types'

interface AboutSectionProps {
  data: ResortData
}

export function AboutSection({ data }: AboutSectionProps) {
  const { tenant, website, rooms } = data
  const primary = website?.primaryColor || '#1a6b5e'
  const accent  = website?.accentColor  || '#d4a853'

  return (
    <section id="about" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: accent }}>
              Our Story
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              {website?.aboutTitle || `Welcome to ${tenant.name}`}
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              {website?.aboutText || 'Experience unparalleled luxury and comfort in our world-class resort, where every detail is crafted to make your stay unforgettable.'}
            </p>
            <div className="grid grid-cols-3 gap-6">
              {[
                { label: 'Check-In',  value: tenant.checkInTime  || '14:00' },
                { label: 'Check-Out', value: tenant.checkOutTime || '11:00' },
                { label: 'Rooms',     value: `${rooms.length}+` },
              ].map(({ label, value }) => (
                <div key={label} className="text-center p-4 rounded-2xl" style={{ backgroundColor: `${primary}08` }}>
                  <p className="text-2xl font-bold" style={{ color: primary }}>{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            {website?.aboutImage ? (
              <img src={website.aboutImage} alt="About" className="w-full h-96 object-cover rounded-3xl shadow-2xl" />
            ) : (
              <div className="w-full h-96 rounded-3xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${primary}20, ${accent}20)` }}>
                <p className="text-gray-400">About image</p>
              </div>
            )}
            {/* Floating badge */}
            <div className="absolute -bottom-6 -left-6 rounded-2xl p-4 shadow-xl bg-white">
              <div className="flex items-center gap-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" style={{ color: accent }} />
                ))}
              </div>
              <p className="text-xs font-medium text-gray-700 mt-1">5-Star Experience</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
