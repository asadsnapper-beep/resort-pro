'use client'
import React, { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'

import { orderSections } from '../_utils/sections'
import type { ThemeProps, ResortRoom } from '../types'
import {
  HeroSection, AboutSection, AmenitiesSection, RoomsSection,
  AvailabilitySection, BookingSection, GallerySection,
  TestimonialsSection, ContactSection, FooterSection,
} from './sections'
import { WhatsAppButton } from '../_widgets/SocialLinks'
import { MenuWidget, VenuesWidget, VehiclesWidget } from '../_widgets'
import { AnnouncementBar, OffersSection, usePublicOffers } from '../_widgets/OffersWidget'

const NAV_ITEMS = [
  { id: 'about',        label: 'About' },
  { id: 'amenities',    label: 'Amenities' },
  { id: 'rooms',        label: 'Rooms' },
  { id: 'menu',         label: 'Menu' },
  { id: 'availability', label: 'Availability' },
  { id: 'gallery',      label: 'Gallery' },
  { id: 'booking',      label: 'Book Now' },
  { id: 'contact',      label: 'Contact' },
]

export function CoastalTheme({ data }: ThemeProps) {
  const { tenant, website } = data
  if (!website) return null

  const primary = website.primaryColor || '#0891b2'
  const accent  = website.accentColor  || '#d97706'

  /* ── Nav state ─────────────────────────── */
  const [navOpen,  setNavOpen]  = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [barVisible, setBarVisible] = useState(true)

  /* ── Calendar → Booking pre-fill ──────── */
  const [calendarCheckIn,  setCalendarCheckIn]  = useState<string | undefined>()
  const [calendarCheckOut, setCalendarCheckOut] = useState<string | undefined>()
  const [calendarRoomId,   setCalendarRoomId]   = useState<string | undefined>()
  const [promoCode,        setPromoCode]        = useState<string | undefined>()

  /* ── Public offers ─────────────────────── */
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
    setCalendarCheckIn(checkIn.toISOString().split('T')[0])
    setCalendarCheckOut(checkOut.toISOString().split('T')[0])
    setCalendarRoomId(room.id)
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleBookRoom = (room: ResortRoom) => {
    setCalendarRoomId(room.id)
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleApplyCode = (code: string) => {
    setPromoCode(code)
    scrollTo('booking')
  }

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans antialiased overflow-x-hidden">

      {/* ── Sticky shell: bar + nav stick together ── */}
      <div className="sticky top-0 z-40">
        {barVisible && (
          <AnnouncementBar
            slug={tenant.slug}
            primaryColor={primary}
            accentColor={accent}
            onHide={() => setBarVisible(false)}
          />
        )}

        {/* ── Navbar ────────────────────────── */}
        <header className={`transition-all duration-300 ${
          scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'
        }`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

          {/* Logo */}
          <button onClick={() => scrollTo('hero')} className="flex items-center gap-2.5">
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.name} className="h-9 w-auto object-contain" />
            ) : (
              <>
                <span className="text-xl">🌊</span>
                <span className={`font-bold tracking-tight transition-colors ${
                  scrolled ? 'text-slate-900' : 'text-white'
                }`}>
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
                className={`text-sm font-medium transition-colors ${
                  item.id === 'booking'
                    ? 'px-5 py-2 rounded-full text-white font-semibold'
                    : scrolled
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-white/80 hover:text-white'
                }`}
                style={item.id === 'booking' ? { backgroundColor: primary } : {}}>
                {item.label}
              </button>
            ))}
          </nav>

          {/* Mobile toggle */}
          <button
            onClick={() => setNavOpen(!navOpen)}
            className={`md:hidden transition-colors ${scrolled ? 'text-slate-700' : 'text-white'}`}>
            {navOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {navOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 shadow-lg px-6 py-4 space-y-1">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="block w-full text-left text-sm font-medium text-slate-700 hover:text-slate-900 py-2.5 border-b border-slate-50 last:border-0">
                {item.label}
              </button>
            ))}
          </div>
        )}
        </header>
      </div>{/* end sticky shell */}

      {/* ── Sections (owner-orderable via website.sectionOrder) ── */}
      {(() => {
        const h = new Set(website.hiddenSections ?? [])
        const show = (id: string) => !h.has(id)
        const accentLocal = website.accentColor || '#0e7490'
        const nodes: Record<string, React.ReactNode> = {
          about:        show('about')        && <AboutSection data={data} />,
          amenities:    show('amenities')    && <AmenitiesSection data={data} />,
          rooms:        <RoomsSection data={data} offers={offers} onViewRoom={handleBookRoom} onBookRoom={handleBookRoom} />,
          menu:         show('menu')         && <MenuWidget slug={tenant.slug} primaryColor={primary} accentColor={accentLocal} currency={tenant.currency} />,
          venues:       show('venues')       && <VenuesWidget slug={tenant.slug} primaryColor={primary} accentColor={accentLocal} currency={tenant.currency} />,
          vehicles:     show('vehicles')     && <VehiclesWidget slug={tenant.slug} primaryColor={primary} accentColor={accentLocal} currency={tenant.currency} />,
          availability: show('availability') && <AvailabilitySection data={data} onRoomSelect={handleRoomSelect} />,
          offers:       show('offers')       && <OffersSection slug={tenant.slug} primaryColor={primary} accentColor={accentLocal} onApplyCode={handleApplyCode} />,
          booking:      <BookingSection data={data} initialCheckIn={calendarCheckIn} initialCheckOut={calendarCheckOut} initialRoomId={calendarRoomId} initialPromoCode={promoCode} />,
          gallery:      show('gallery')      && <GallerySection data={data} />,
          testimonials: show('testimonials') && <TestimonialsSection data={data} />,
          contact:      show('contact')      && <ContactSection data={data} />,
        }
        const order = orderSections(
          ['about', 'amenities', 'rooms', 'menu', 'venues', 'vehicles', 'availability', 'offers', 'booking', 'gallery', 'testimonials', 'contact'],
          website.sectionOrder,
        )
        return (
          <>
            <HeroSection data={data} scrollTo={scrollTo} />
            {order.map(id => <React.Fragment key={id}>{nodes[id]}</React.Fragment>)}
            <FooterSection data={data} scrollTo={scrollTo} />
          </>
        )
      })()}
      <WhatsAppButton whatsappNumber={data.website?.whatsappNumber} />
    </div>
  )
}
