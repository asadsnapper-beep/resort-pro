'use client'
import React, { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'

import { orderSections } from '../_utils/sections'
import { toLocalDateKey } from '../_utils/date'
import type { ThemeProps, ResortRoom } from '../types'
import {
  HeroSection, AboutSection, RoomsSection, GallerySection,
  TestimonialsSection, AvailabilitySection, BookingSection,
  ContactSection, FooterSection,
} from './sections'
import { WhatsAppButton } from '../_widgets/SocialLinks'
import { MenuWidget, VenuesWidget, VehiclesWidget } from '../_widgets'
import { AnnouncementBar, OffersSection, usePublicOffers } from '../_widgets/OffersWidget'

const NAV_ITEMS = [
  { id: 'about',        label: 'About' },
  { id: 'rooms',        label: 'Rooms' },
  { id: 'menu',         label: 'Menu' },
  { id: 'availability', label: 'Availability' },
  { id: 'gallery',      label: 'Gallery' },
  { id: 'booking',      label: 'Book Now' },
  { id: 'contact',      label: 'Contact' },
]

export function TeaGardenEcoResortTheme({ data }: ThemeProps) {
  const { tenant, website } = data
  if (!website) return null

  const primary = website.primaryColor || '#1a6b2a'
  const accent  = website.accentColor  || '#d3d558'

  /* ── State ───────────────────────────────────── */
  const [navOpen,    setNavOpen]    = useState(false)
  const [scrolled,   setScrolled]   = useState(false)
  const [barVisible, setBarVisible] = useState(true)

  /* ── Calendar → Booking pre-fill ────────────── */
  const [calendarCheckIn,  setCalendarCheckIn]  = useState<string | undefined>()
  const [calendarCheckOut, setCalendarCheckOut] = useState<string | undefined>()
  const [calendarRoomId,   setCalendarRoomId]   = useState<string | undefined>()
  const [promoCode,        setPromoCode]        = useState<string | undefined>()

  /* ── Public offers ───────────────────────────── */
  const offers = usePublicOffers(tenant.slug)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setNavOpen(false)
  }

  const handleRoomSelect = (room: ResortRoom, checkIn: Date, checkOut: Date) => {
    setCalendarCheckIn(toLocalDateKey(checkIn))
    setCalendarCheckOut(toLocalDateKey(checkOut))
    setCalendarRoomId(room.id)
    scrollTo('booking')
  }

  const handleBookRoom = (room: ResortRoom) => {
    setCalendarRoomId(room.id)
    scrollTo('booking')
  }

  const handleApplyCode = (code: string) => {
    setPromoCode(code)
    scrollTo('booking')
  }

  const h    = new Set(website.hiddenSections ?? [])
  const show = (id: string) => !h.has(id)

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans antialiased overflow-x-hidden">

      {/* ── Sticky shell: announcement bar + navbar ── */}
      <div className="sticky top-0 z-40">
        {barVisible && (
          <AnnouncementBar
            slug={tenant.slug}
            primaryColor={primary}
            accentColor={accent}
            onHide={() => setBarVisible(false)}
          />
        )}

        {/* ── Navbar ───────────────────────────────── */}
        <header
          className="transition-all duration-300"
          style={scrolled
            ? { backgroundColor: 'rgba(255,255,255,0.97)', boxShadow: '0 1px 12px rgba(26,107,42,0.10)' }
            : { backgroundColor: 'transparent' }
          }
        >
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

            {/* Logo */}
            <button onClick={() => scrollTo('hero')} className="flex items-center gap-2.5">
              {tenant.logoUrl ? (
                <img src={tenant.logoUrl} alt={tenant.name} className="h-9 w-auto object-contain" />
              ) : (
                <>
                  <span className="text-xl">🌿</span>
                  <span
                    className="font-serif font-bold tracking-tight transition-colors text-lg"
                    style={{ color: scrolled ? primary : 'white' }}
                  >
                    {tenant.name}
                  </span>
                </>
              )}
            </button>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-6">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className="text-sm font-medium transition-colors"
                  style={
                    item.id === 'booking'
                      ? {
                          backgroundColor: accent,
                          color: '#1a2d0a',
                          padding: '8px 20px',
                          borderRadius: '999px',
                          fontWeight: 600,
                        }
                      : { color: scrolled ? '#374151' : 'rgba(255,255,255,0.85)' }
                  }
                  onMouseEnter={e => {
                    if (item.id !== 'booking') {
                      (e.currentTarget as HTMLElement).style.color = scrolled ? primary : 'white'
                    }
                  }}
                  onMouseLeave={e => {
                    if (item.id !== 'booking') {
                      (e.currentTarget as HTMLElement).style.color = scrolled ? '#374151' : 'rgba(255,255,255,0.85)'
                    }
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Mobile toggle */}
            <button
              onClick={() => setNavOpen(!navOpen)}
              className="md:hidden transition-colors"
              style={{ color: scrolled ? primary : 'white' }}
            >
              {navOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile dropdown */}
          {navOpen && (
            <div className="md:hidden bg-white border-t shadow-lg px-6 py-4 space-y-1"
              style={{ borderColor: `${primary}20` }}>
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className="block w-full text-left text-sm font-medium py-2.5 border-b last:border-0 transition-colors"
                  style={{ color: primary, borderColor: `${primary}15` }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </header>
      </div>{/* end sticky shell */}

      {/* ── Sections (owner-orderable via website.sectionOrder) ── */}
      <HeroSection data={data} scrollTo={scrollTo} />

      {(() => {
        const nodes: Record<string, React.ReactNode> = {
          about: show('about') && <AboutSection data={data} />,
          rooms: (
            <RoomsSection
              data={data}
              offers={offers}
              onViewRoom={handleBookRoom}
              onBookRoom={handleBookRoom}
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
            <AvailabilitySection data={data} onRoomSelect={handleRoomSelect} />
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
            <BookingSection
              data={data}
              initialCheckIn={calendarCheckIn}
              initialCheckOut={calendarCheckOut}
              initialRoomId={calendarRoomId}
              initialPromoCode={promoCode}
            />
          ),
          gallery:      show('gallery')      && <GallerySection data={data} />,
          testimonials: show('testimonials') && <TestimonialsSection data={data} />,
          contact:      show('contact')      && <ContactSection data={data} />,
        }
        const order = orderSections(
          ['about', 'rooms', 'menu', 'venues', 'vehicles', 'availability', 'offers', 'booking', 'gallery', 'testimonials', 'contact'],
          website.sectionOrder,
        )
        return order.map(id => <React.Fragment key={id}>{nodes[id]}</React.Fragment>)
      })()}

      <FooterSection data={data} scrollTo={scrollTo} />
      <WhatsAppButton whatsappNumber={website.whatsappNumber} />
    </div>
  )
}
