'use client'
import type { ResortData } from '../../types'

interface AboutSectionProps {
  data: ResortData
}

export function AboutSection({ data }: AboutSectionProps) {
  const { tenant, website, rooms } = data
  const primary = website?.primaryColor || '#2563eb'

  return (
    <section id="about" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left: text */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-5"
              style={{ color: primary }}>
              About
            </p>
            <h2 className="text-4xl font-bold text-slate-900 leading-tight mb-6">
              {website?.aboutTitle || `Welcome to ${tenant.name}`}
            </h2>
            <p className="text-slate-500 leading-relaxed mb-10">
              {website?.aboutText || 'Experience unparalleled luxury and comfort in our world-class resort, where every detail is crafted to make your stay unforgettable.'}
            </p>

            {/* Stats row */}
            <div className="flex gap-10 pt-8 border-t border-slate-100">
              {[
                { label: 'Check-in',  value: tenant.checkInTime  || '14:00' },
                { label: 'Check-out', value: tenant.checkOutTime || '11:00' },
                { label: 'Rooms',     value: `${rooms.length}` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-2xl font-bold text-slate-900">{value}</p>
                  <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-wide">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: image */}
          <div>
            {website?.aboutImage ? (
              <img
                src={website.aboutImage}
                alt="About"
                className="w-full aspect-square object-cover rounded-sm shadow-sm"
              />
            ) : (
              <div className="w-full aspect-square bg-slate-100 rounded-sm flex items-center justify-center">
                <p className="text-slate-300 text-sm">About image</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
