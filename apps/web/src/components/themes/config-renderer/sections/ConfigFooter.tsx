'use client'
import { Facebook, Instagram, Twitter, Youtube, Music2 } from 'lucide-react'
import type { ResortData } from '../../types'
import type { ThemeConfig } from '../config-types'

interface Props {
  data:     ResortData
  config:   ThemeConfig
  scrollTo: (id: string) => void
}

export function ConfigFooter({ data, config, scrollTo }: Props) {
  const { tenant, website } = data
  const { colors, footer, fonts, sections } = config
  const primary     = website?.primaryColor || colors.primary
  const accent      = website?.accentColor  || colors.accent
  const bg          = footer?.background || '#111827'
  const headingFont = fonts.heading === 'serif' ? 'Georgia, Cambria, serif' : 'inherit'

  const navLinks = sections.filter(s => s !== 'hero').slice(0, 6)

  function sectionLabel(id: string) {
    const map: Record<string, string> = {
      availability: 'Availability',
      booking:      'Book Now',
      contact:      'Contact Us',
    }
    return map[id] || (id.charAt(0).toUpperCase() + id.slice(1))
  }

  return (
    <footer>
      {/* Wave divider */}
      {footer?.divider === 'wave' && (
        <div style={{ lineHeight: 0, backgroundColor: colors.background }}>
          <svg viewBox="0 0 1440 56" preserveAspectRatio="none" className="w-full" style={{ display: 'block', height: '56px' }}>
            <path
              d="M0,28 C360,56 1080,0 1440,28 L1440,56 L0,56 Z"
              fill={bg}
            />
          </svg>
        </div>
      )}

      <div style={{ backgroundColor: bg }}>
        <div className="max-w-7xl mx-auto px-6 pt-16 pb-10">

          <div className="grid md:grid-cols-3 gap-10 mb-12">

            {/* Brand */}
            <div>
              {tenant.logoUrl ? (
                <img
                  src={tenant.logoUrl}
                  alt={tenant.name}
                  className="h-10 w-auto mb-4 brightness-0 invert"
                />
              ) : (
                <p
                  className="font-bold text-xl mb-4 text-white"
                  style={{ fontFamily: headingFont }}
                >
                  {tenant.name}
                </p>
              )}
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {website?.aboutText
                  ? website.aboutText.slice(0, 110) + '…'
                  : `Welcome to ${tenant.name}. We look forward to hosting you.`}
              </p>
            </div>

            {/* Quick links */}
            <div>
              <p className="font-semibold text-sm uppercase tracking-wider mb-5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Quick Links
              </p>
              <ul className="space-y-2">
                {navLinks.map(id => (
                  <li key={id}>
                    <button
                      onClick={() => scrollTo(id)}
                      className="text-sm transition-colors"
                      style={{ color: 'rgba(255,255,255,0.45)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                    >
                      {sectionLabel(id)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact + Social */}
            <div>
              <p className="font-semibold text-sm uppercase tracking-wider mb-5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Contact
              </p>
              <ul className="space-y-2 mb-6 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {tenant.phone   && <li>{tenant.phone}</li>}
                {tenant.email   && <li>{tenant.email}</li>}
                {tenant.address && <li>{tenant.address}</li>}
              </ul>

              <div className="flex gap-3">
                {website?.facebookUrl  && (
                  <a href={website.facebookUrl}  target="_blank" rel="noopener" style={{ color: 'rgba(255,255,255,0.35)' }} className="hover:opacity-80 transition-opacity">
                    <Facebook className="h-4 w-4" />
                  </a>
                )}
                {website?.instagramUrl && (
                  <a href={website.instagramUrl} target="_blank" rel="noopener" style={{ color: 'rgba(255,255,255,0.35)' }} className="hover:opacity-80 transition-opacity">
                    <Instagram className="h-4 w-4" />
                  </a>
                )}
                {website?.twitterUrl   && (
                  <a href={website.twitterUrl}   target="_blank" rel="noopener" style={{ color: 'rgba(255,255,255,0.35)' }} className="hover:opacity-80 transition-opacity">
                    <Twitter className="h-4 w-4" />
                  </a>
                )}
                {website?.youtubeUrl   && (
                  <a href={website.youtubeUrl}   target="_blank" rel="noopener" style={{ color: 'rgba(255,255,255,0.35)' }} className="hover:opacity-80 transition-opacity">
                    <Youtube className="h-4 w-4" />
                  </a>
                )}
                {website?.tiktokUrl    && (
                  <a href={website.tiktokUrl}    target="_blank" rel="noopener" style={{ color: 'rgba(255,255,255,0.35)' }} className="hover:opacity-80 transition-opacity">
                    <Music2 className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
              © {new Date().getFullYear()} {tenant.name}. All rights reserved.
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
              Powered by ResortPro
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
