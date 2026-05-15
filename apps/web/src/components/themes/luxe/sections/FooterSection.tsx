'use client'
import { Phone, Mail, MapPin } from 'lucide-react'
import type { ResortData } from '../../types'
import { SocialLinks } from '../../_widgets/SocialLinks'

interface FooterSectionProps {
  data: ResortData
  scrollTo: (id: string) => void
}

const NAV_ITEMS = [
  { id: 'about',        label: 'About' },
  { id: 'rooms',        label: 'Rooms' },
  { id: 'availability', label: 'Availability' },
  { id: 'menu',         label: 'Menu' },
  { id: 'gallery',      label: 'Gallery' },
  { id: 'booking',      label: 'Book Now' },
  { id: 'feedback',     label: 'Contact' },
]

export function FooterSection({ data, scrollTo }: FooterSectionProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '#1a6b5e'

  return (
    <footer className="py-16 text-white" style={{ backgroundColor: primary }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-12 mb-12">
          {/* Brand */}
          <div>
            <p className="text-xl font-bold mb-4">{tenant.name}</p>
            <p className="text-white/60 text-sm leading-relaxed">
              {website?.aboutText
                ? website.aboutText.substring(0, 120) + ((website.aboutText.length ?? 0) > 120 ? '…' : '')
                : 'Experience luxury at its finest.'}
            </p>
          </div>

          {/* Quick links */}
          <div>
            <p className="font-semibold text-white/80 mb-4 text-sm uppercase tracking-wider">Quick Links</p>
            <div className="space-y-2">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className="block text-sm text-white/60 hover:text-white transition-colors text-left">
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="font-semibold text-white/80 mb-4 text-sm uppercase tracking-wider">Contact</p>
            <div className="space-y-3 text-sm text-white/60">
              {tenant.phone   && <p className="flex items-center gap-2"><Phone  className="h-4 w-4 flex-shrink-0" />{tenant.phone}</p>}
              {tenant.email   && <p className="flex items-center gap-2"><Mail   className="h-4 w-4 flex-shrink-0" />{tenant.email}</p>}
              {tenant.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 flex-shrink-0" />{tenant.address}</p>}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/40 text-xs">© {new Date().getFullYear()} {tenant.name}. All rights reserved.</p>
          <SocialLinks website={website ?? null} className="text-white" iconClassName="w-4 h-4" />
          <p className="text-white/30 text-xs">Powered by ResortPro</p>
        </div>
      </div>
    </footer>
  )
}
