'use client'
import { Phone, Mail, MapPin } from 'lucide-react'
import type { ResortData } from '../../types'
import { SocialLinks } from '../../_widgets/SocialLinks'

interface FooterSectionProps {
  data:     ResortData
  scrollTo: (id: string) => void
}

const NAV_ITEMS = [
  { id: 'about',        label: 'About' },
  { id: 'rooms',        label: 'Rooms' },
  { id: 'menu',         label: 'Menu' },
  { id: 'gallery',      label: 'Gallery' },
  { id: 'availability', label: 'Availability' },
  { id: 'booking',      label: 'Book Now' },
  { id: 'contact',      label: 'Contact' },
]

export function FooterSection({ data, scrollTo }: FooterSectionProps) {
  const { tenant, website } = data
  const accent = website?.accentColor || '#d3d558'

  return (
    <footer style={{ backgroundColor: '#0d3318' }} className="text-white">

      {/* Leaf-wave SVG divider */}
      <div className="overflow-hidden leading-none">
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg"
          className="w-full block" style={{ transform: 'translateY(1px)' }}>
          <path
            d="M0 40 C180 10 360 60 540 40 C720 20 900 60 1080 40 C1260 20 1380 50 1440 40 L1440 0 L0 0 Z"
            fill="white"
          />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-8 pb-16">
        <div className="grid md:grid-cols-3 gap-12 mb-12">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🌿</span>
              <p className="font-serif text-xl font-bold">{tenant.name}</p>
            </div>
            <p className="text-white/50 text-sm leading-relaxed">
              {website?.aboutText
                ? website.aboutText.substring(0, 130) + ((website.aboutText.length ?? 0) > 130 ? '…' : '')
                : 'An eco retreat nestled in lush tea gardens. Where misty mornings and verdant hillsides restore the soul.'}
            </p>
            {/* Accent line */}
            <div className="mt-6 h-0.5 w-16 rounded-full" style={{ backgroundColor: accent }} />
          </div>

          {/* Quick links */}
          <div>
            <p className="font-semibold text-white/50 mb-5 text-xs uppercase tracking-widest">
              Quick Links
            </p>
            <div className="grid grid-cols-2 gap-y-2.5">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className="text-left text-sm text-white/50 hover:text-white transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="font-semibold text-white/50 mb-5 text-xs uppercase tracking-widest">
              Contact
            </p>
            <div className="space-y-3 text-sm text-white/50">
              {tenant.phone && (
                <p className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 flex-shrink-0 text-white/30" />
                  {tenant.phone}
                </p>
              )}
              {tenant.email && (
                <p className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 flex-shrink-0 text-white/30" />
                  {tenant.email}
                </p>
              )}
              {tenant.address && (
                <p className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 flex-shrink-0 text-white/30 mt-0.5" />
                  {tenant.address}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} {tenant.name}. All rights reserved.
          </p>
          <SocialLinks website={website ?? null} className="text-white" iconClassName="w-4 h-4" />
          <p className="text-white/20 text-xs">Powered by ResortPro</p>
        </div>
      </div>
    </footer>
  )
}
