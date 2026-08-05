'use client'
import { orderSections } from '../_utils/sections'
import { toLocalDateKey } from '../_utils/date'
import React, { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import type { ResortData, ResortRoom } from '../types'
import type { ThemeConfig } from './config-types'
import { mergeConfig } from './config-types'
import {
  ConfigHero, ConfigAbout, ConfigRooms, ConfigGallery,
  ConfigTestimonials, ConfigFooter,
  ConfigAvailability, ConfigBooking, ConfigContact,
} from './sections'
import { WhatsAppButton } from '../_widgets/SocialLinks'
import { MenuWidget, VenuesWidget, VehiclesWidget } from '../_widgets'
import { AnnouncementBar, OffersSection, usePublicOffers } from '../_widgets/OffersWidget'

/* ── ConfigThemeRenderer ─────────────────────────────────────────────────────
   Renders any uploaded or AI-generated theme from a ThemeConfig JSON.
   Hardcoded themes (luxe, minimal, coastal) still use their own components.
──────────────────────────────────────────────────────────────────────────── */

export interface ConfigThemeProps {
  data:   ResortData
  config: Partial<ThemeConfig>
}

export function ConfigThemeRenderer({ data, config: rawConfig }: ConfigThemeProps) {
  const config = mergeConfig(rawConfig)
  const { tenant, website } = data
  if (!website) return null

  const primary     = website.primaryColor || config.colors.primary
  const accent      = website.accentColor  || config.colors.accent
  const headingFont = config.fonts.heading === 'serif' ? 'Georgia, Cambria, serif' : 'inherit'

  /* ── State ─────────────────────────────────────────────────────────────── */
  const [navOpen,    setNavOpen]    = useState(false)
  const [scrolled,   setScrolled]   = useState(false)
  const [barVisible, setBarVisible] = useState(true)

  /* ── Calendar → Booking pre-fill ──────────────────────────────────────── */
  const [calendarCheckIn,  setCalendarCheckIn]  = useState<string | undefined>()
  const [calendarCheckOut, setCalendarCheckOut] = useState<string | undefined>()
  const [calendarRoomId,   setCalendarRoomId]   = useState<string | undefined>()
  const [promoCode,        setPromoCode]        = useState<string | undefined>()

  const offers = usePublicOffers(tenant.slug)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id: string) => {
    const section = document.getElementById(id)
    const navHeight = document.getElementById('public-site-nav')?.offsetHeight ?? 64
    if (section) {
      window.scrollTo({
        top: Math.max(0, section.getBoundingClientRect().top + window.scrollY - navHeight - 16),
        behavior: 'smooth',
      })
    }
    setNavOpen(false)
  }

  const handleRoomSelect = (room: ResortRoom, checkIn: Date, checkOut: Date) => {
    setCalendarCheckIn(toLocalDateKey(checkIn))
    setCalendarCheckOut(toLocalDateKey(checkOut))
    setCalendarRoomId(room.id)
    scrollTo('booking')
  }

  const handleApplyCode = (code: string) => {
    setPromoCode(code)
    scrollTo('booking')
  }

  const h    = new Set(website.hiddenSections ?? [])
  const show = (id: string) => !h.has(id)

  /* ── Navbar style logic ────────────────────────────────────────────────── */
  const navStyle = config.navbar.style
  const isSolid  = navStyle === 'solid'

  // Detect if the hero background (behind transparent navbar) will be light or dark.
  // Split/minimal: navbar sits over page background — check that color's luminance.
  // Fullscreen: check the overlay alpha; low alpha = image bleeds through.
  function hexLum(hex: string): number {
    const h = hex.replace('#', '')
    if (h.length < 6) return 0.5
    const r = parseInt(h.slice(0, 2), 16) / 255
    const g = parseInt(h.slice(2, 4), 16) / 255
    const b = parseInt(h.slice(4, 6), 16) / 255
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  function overlayAlpha(): number {
    const { overlayColor, overlayOpacity } = config.hero
    if (overlayColor) {
      const m = overlayColor.match(/[\d.]+\s*\)$/)
      return m ? parseFloat(m[0]) : overlayOpacity ?? 0.5
    }
    return overlayOpacity ?? 0.5
  }

  // True when the transparent navbar needs dark text (sits on a light surface)
  const needsDarkNav =
    isSolid ? false
    : config.hero.layout !== 'fullscreen'     // split/minimal: navbar over page bg
      ? hexLum(config.colors.background) > 0.55
      : overlayAlpha() < 0.38                 // fullscreen light overlay
        || hexLum(config.colors.background) > 0.75

  const navBg     = isSolid ? primary : scrolled ? 'rgba(255,255,255,0.97)' : 'transparent'
  const navColor  = isSolid ? 'var(--rp-surface)'
    : scrolled         ? '#111827'
    : needsDarkNav     ? '#1a1a2e'
    : 'rgba(255,255,255,0.95)'
  const logoColor = isSolid ? 'var(--rp-surface)'
    : scrolled         ? primary
    : needsDarkNav     ? primary
    : 'var(--rp-surface)'
  const navShadow = scrolled && !isSolid ? '0 2px 16px rgba(0,0,0,0.10)' : 'none'
  const showScrim = !isSolid && !scrolled && !needsDarkNav  // only add scrim when white text is used

  const navLinks = config.navbar.links
    ?? config.sections.filter(s => s !== 'hero')

  function sectionLabel(id: string) {
    const map: Record<string, string> = {
      availability: 'Availability',
      booking:      'Book Now',
      contact:      'Contact',
    }
    return map[id] || (id.charAt(0).toUpperCase() + id.slice(1))
  }

  return (
    <div
      style={{ backgroundColor: config.colors.background, color: config.colors.text }}
      className="min-h-screen antialiased overflow-x-hidden"
    >
      {/* Inject custom CSS if provided */}
      {config.customCSS && (
        <style dangerouslySetInnerHTML={{ __html: config.customCSS }} />
      )}

      {/* ── Fixed navbar shell ──────────────────────────────────────────── */}
      <div id="public-site-nav" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40 }}>
        {barVisible && (
          <AnnouncementBar
            slug={tenant.slug}
            primaryColor={primary}
            accentColor={accent}
            onHide={() => setBarVisible(false)}
          />
        )}

        <header
          className="transition-all duration-300"
          style={{
            backgroundColor: navBg,
            boxShadow: navShadow,
            borderBottom: scrolled && !isSolid ? '1px solid rgba(0,0,0,0.06)' : 'none',
          }}
        >
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

            {/* Logo */}
            <button onClick={() => scrollTo('hero')} className="flex items-center gap-2">
              {tenant.logoUrl ? (
                <img src={tenant.logoUrl} alt={tenant.name} className="h-9 w-auto object-contain" />
              ) : (
                <span
                  className="font-bold tracking-tight text-lg transition-colors"
                  style={{ color: logoColor, fontFamily: headingFont }}
                >
                  {config.navbar.logoEmoji ? `${config.navbar.logoEmoji} ` : ''}{tenant.name}
                </span>
              )}
            </button>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map(id => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className="text-sm font-medium transition-colors"
                  style={
                    id === 'booking'
                      ? { backgroundColor: accent, color: config.colors.text, padding: '8px 20px', borderRadius: '999px', fontWeight: 600 }
                      : { color: navColor }
                  }
                  onMouseEnter={e => {
                    if (id !== 'booking') {
                      (e.currentTarget as HTMLElement).style.color = primary
                    }
                  }}
                  onMouseLeave={e => {
                    if (id !== 'booking') {
                      (e.currentTarget as HTMLElement).style.color = navColor
                    }
                  }}
                >
                  {sectionLabel(id)}
                </button>
              ))}
            </nav>

            {/* Mobile toggle */}
            <button
              onClick={() => setNavOpen(!navOpen)}
              className="md:hidden transition-colors"
              style={{ color: logoColor }}
            >
              {navOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile dropdown */}
          {navOpen && (
            <div
              className="md:hidden bg-white border-t px-6 py-4 space-y-1"
              style={{ borderColor: `${primary}20` }}
            >
              {navLinks.map(id => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className="block w-full text-left text-sm font-medium py-2.5 border-b last:border-0"
                  style={{ color: primary, borderColor: `${primary}15` }}
                >
                  {sectionLabel(id)}
                </button>
              ))}
            </div>
          )}
        </header>
      </div>

      {/* ── Sections (owner-orderable via website.sectionOrder) ── */}
      <ConfigHero data={data} config={config} scrollTo={scrollTo} showScrim={showScrim} />

      {(() => {
        const nodes: Record<string, React.ReactNode> = {
          about: show('about') && <ConfigAbout data={data} config={config} />,
          rooms: (
            <ConfigRooms
              data={data}
              config={config}
              onBookRoom={room => { setCalendarRoomId(room.id); scrollTo('booking') }}
            />
          ),
          menu: show('menu') && (
            <MenuWidget
              slug={tenant.slug}
              primaryColor={primary}
              accentColor={accent}
              currency={tenant.currency}
            />
          ),
          venues: show('venues') && (
            <VenuesWidget
              slug={tenant.slug}
              primaryColor={primary}
              accentColor={accent}
              currency={tenant.currency}
            />
          ),
          vehicles: show('vehicles') && (
            <VehiclesWidget
              slug={tenant.slug}
              primaryColor={primary}
              accentColor={accent}
              currency={tenant.currency}
            />
          ),
          availability: show('availability') && (
            <ConfigAvailability data={data} config={config} onRoomSelect={handleRoomSelect} />
          ),
          offers: show('offers') && (
            <OffersSection
              slug={tenant.slug}
              primaryColor={primary}
              accentColor={accent}
              onApplyCode={handleApplyCode}
            />
          ),
          booking: (
            <ConfigBooking
              data={data}
              config={config}
              initialCheckIn={calendarCheckIn}
              initialCheckOut={calendarCheckOut}
              initialRoomId={calendarRoomId}
              initialPromoCode={promoCode}
            />
          ),
          gallery:      show('gallery')      && <ConfigGallery      data={data} config={config} />,
          testimonials: show('testimonials') && <ConfigTestimonials  data={data} config={config} />,
          contact:      show('contact')      && <ConfigContact       data={data} config={config} />,
        }
        const order = orderSections(
          ['about', 'rooms', 'menu', 'venues', 'vehicles', 'availability', 'offers', 'booking', 'gallery', 'testimonials', 'contact'],
          website.sectionOrder,
        )
        return order.map(id => <React.Fragment key={id}>{nodes[id]}</React.Fragment>)
      })()}

      <ConfigFooter data={data} config={config} scrollTo={scrollTo} />
      <WhatsAppButton whatsappNumber={website.whatsappNumber} />
    </div>
  )
}
