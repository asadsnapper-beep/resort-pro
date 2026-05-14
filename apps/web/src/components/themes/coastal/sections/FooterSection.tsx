'use client'
import { Phone, Mail, MapPin } from 'lucide-react'
import type { ResortData } from '../../types'

interface FooterSectionProps {
  data:     ResortData
  scrollTo: (id: string) => void
}

const NAV_ITEMS = [
  { id: 'about',        label: 'About' },
  { id: 'amenities',    label: 'Amenities' },
  { id: 'rooms',        label: 'Rooms' },
  { id: 'availability', label: 'Availability' },
  { id: 'gallery',      label: 'Gallery' },
  { id: 'booking',      label: 'Book Now' },
  { id: 'contact',      label: 'Contact' },
]

export function FooterSection({ data, scrollTo }: FooterSectionProps) {
  const { tenant, website } = data
  const accent = website?.accentColor || '#d97706'

  return (
    <footer style={{ backgroundColor: '#164e63' }} className="text-white">
      {/* Wave top border */}
      <div className="overflow-hidden leading-none">
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full block"
          style={{ transform: 'translateY(1px)' }}>
          <path
            d="M0 30 C240 0 480 60 720 30 C960 0 1200 60 1440 30 L1440 0 L0 0 Z"
            fill="white"
          />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-8 pb-16">
        <div className="grid md:grid-cols-3 gap-12 mb-12">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🌊</span>
              <p className="text-xl font-bold">{tenant.name}</p>
            </div>
            <p className="text-white/50 text-sm leading-relaxed">
              {website?.aboutText
                ? website.aboutText.substring(0, 130) + ((website.aboutText.length ?? 0) > 130 ? '…' : '')
                : 'Your perfect coastal escape. Where the ocean breeze meets world-class hospitality.'}
            </p>
            {/* Accent wave underline */}
            <div className="mt-6">
              <svg viewBox="0 0 120 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-24">
                <path d="M0 6 C20 12 40 0 60 6 C80 12 100 0 120 6" stroke={accent} strokeWidth="2" fill="none"/>
              </svg>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <p className="font-semibold text-white/60 mb-5 text-xs uppercase tracking-widest">
              Quick Links
            </p>
            <div className="grid grid-cols-2 gap-y-2">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className="text-left text-sm text-white/50 hover:text-white transition-colors">
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="font-semibold text-white/60 mb-5 text-xs uppercase tracking-widest">
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
          <p className="text-white/20 text-xs">Powered by ResortPro</p>
        </div>
      </div>
    </footer>
  )
}
