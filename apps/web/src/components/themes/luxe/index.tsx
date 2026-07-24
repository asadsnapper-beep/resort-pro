'use client'
import React, { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'

import type { ThemeProps, ResortRoom } from '../types'
import { orderSections } from '../_utils/sections'

const LUXE_SECTION_ORDER = ['about', 'rooms', 'menu', 'venues', 'vehicles', 'gallery', 'testimonials', 'availability', 'booking', 'contact'] as const
import { AvailabilityCalendar, BookingForm, MenuWidget, ContactForm, VenuesWidget, VehiclesWidget } from '../_widgets'
import { WhatsAppButton } from '../_widgets/SocialLinks'
import {
  HeroSection, AboutSection, RoomsSection,
  GallerySection, TestimonialsSection, FooterSection,
} from './sections'
import { RoomModal, BookingModal } from './components'

const NAV_ITEMS = [
  { id: 'about',        label: 'About' },
  { id: 'rooms',        label: 'Rooms' },
  { id: 'availability', label: 'Availability' },
  { id: 'menu',         label: 'Menu' },
  { id: 'gallery',      label: 'Gallery' },
  { id: 'booking',      label: 'Book Now' },
  { id: 'feedback',     label: 'Contact' },
]

export function LuxeTheme({ data }: ThemeProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '#1a6b5e'
  const accent  = website?.accentColor  || '#d4a853'

  /* ── Nav state ─────────────────────────────────────────── */
  const [navOpen,       setNavOpen]       = useState(false)
  const [scrolled,      setScrolled]      = useState(false)
  const [activeSection, setActiveSection] = useState('hero')

  /* ── Modal state ───────────────────────────────────────── */
  const [selectedRoom, setSelectedRoom] = useState<ResortRoom | null>(null)
  const [bookingRoom,  setBookingRoom]  = useState<ResortRoom | null>(null)

  /* ── Calendar → Booking pre-fill ──────────────────────── */
  const [calendarCheckIn,  setCalendarCheckIn]  = useState('')
  const [calendarCheckOut, setCalendarCheckOut] = useState('')
  const [calendarRoomId,   setCalendarRoomId]   = useState('')

  /* ── Scroll tracking ───────────────────────────────────── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* ── Section observer ──────────────────────────────────── */
  useEffect(() => {
    const ids = ['hero', 'about', 'rooms', 'menu', 'gallery', 'availability', 'booking', 'feedback']
    const observers = ids.map(id => {
      const el = document.getElementById(id)
      if (!el) return null
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id) },
        { threshold: 0.3 }
      )
      obs.observe(el)
      return obs
    })
    return () => observers.forEach(o => o?.disconnect())
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setNavOpen(false)
  }

  return (
    <div className="min-h-screen font-sans antialiased">

      {/* ── Navbar ────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

          {/* Logo */}
          <button onClick={() => scrollTo('hero')} className="flex items-center gap-3">
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.name} className="h-9 w-auto object-contain" />
            ) : (
              <span className="text-xl font-bold tracking-tight"
                style={{ color: scrolled ? primary : 'white' }}>
                {tenant.name}
              </span>
            )}
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => scrollTo(item.id)}
                className={`text-sm font-medium transition-colors ${
                  item.id === 'booking'
                    ? 'text-white px-5 py-2 rounded-full'
                    : scrolled
                      ? `${activeSection === item.id ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'}`
                      : `${activeSection === item.id ? 'text-white' : 'text-white/80 hover:text-white'}`
                }`}
                style={item.id === 'booking' ? { backgroundColor: accent } : {}}>
                {item.label}
              </button>
            ))}
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setNavOpen(!navOpen)} className="md:hidden"
            style={{ color: scrolled ? '#374151' : 'white' }}>
            {navOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {navOpen && (
          <div className="md:hidden bg-white border-t shadow-lg px-6 py-4 space-y-3">
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => scrollTo(item.id)}
                className="block w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900 py-2">
                {item.label}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* ── Sections (owner-orderable via website.sectionOrder) ── */}
      <HeroSection data={data} scrollTo={scrollTo} />
      {(() => {
        const h = new Set(website.hiddenSections ?? [])
        const show = (id: string) => !h.has(id)
        const nodes: Record<string, React.ReactNode> = {
          about: show('about') && <AboutSection data={data} />,
          rooms: <RoomsSection data={data} onViewRoom={setSelectedRoom} onBookRoom={setBookingRoom} />,
          menu: show('menu') && (
            <MenuWidget slug={tenant.slug} primaryColor={primary} accentColor={accent} currency={tenant.currency} />
          ),
          venues: show('venues') && (
            <VenuesWidget slug={tenant.slug} primaryColor={primary} accentColor={accent} currency={tenant.currency} />
          ),
          vehicles: show('vehicles') && (
            <VehiclesWidget slug={tenant.slug} primaryColor={primary} accentColor={accent} currency={tenant.currency} />
          ),
          gallery: show('gallery') && <GallerySection data={data} />,
          testimonials: show('testimonials') && <TestimonialsSection data={data} />,
          availability: show('availability') && (
            <section id="availability" className="py-20 bg-stone-50">
              <div className="max-w-4xl mx-auto px-6">
                <div className="text-center mb-10">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>
                    Availability
                  </p>
                  <h2 className="text-4xl font-bold text-gray-900">Check Availability</h2>
                  <p className="mt-3 text-gray-500">Select your dates to see available rooms</p>
                </div>
                <AvailabilityCalendar
                  slug={tenant.slug}
                  primaryColor={primary}
                  accentColor={accent}
                  currency={tenant.currency}
                  onRoomSelect={(room, checkIn, checkOut) => {
                    setCalendarCheckIn(checkIn.toISOString().split('T')[0])
                    setCalendarCheckOut(checkOut.toISOString().split('T')[0])
                    setCalendarRoomId(room.id)
                    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                />
              </div>
            </section>
          ),
          booking: (
            <section id="booking" className="py-24 bg-gray-50">
              <div className="max-w-4xl mx-auto px-6">
                <div className="text-center mb-12">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>
                    Reserve
                  </p>
                  <h2 className="text-4xl font-bold text-gray-900">Book Your Stay</h2>
                  <p className="mt-3 text-gray-500">
                    Check-in: {tenant.checkInTime} · Check-out: {tenant.checkOutTime}
                  </p>
                </div>
                <BookingForm
                  slug={tenant.slug}
                  primaryColor={primary}
                  accentColor={accent}
                  currency={tenant.currency}
                  rooms={data.rooms}
                  checkInTime={tenant.checkInTime}
                  checkOutTime={tenant.checkOutTime}
                  initialCheckIn={calendarCheckIn   || undefined}
                  initialCheckOut={calendarCheckOut || undefined}
                  initialRoomId={calendarRoomId     || undefined}
                />
              </div>
            </section>
          ),
          contact: show('contact') && (
            <section id="feedback" className="py-24 bg-white">
              <div className="max-w-2xl mx-auto px-6">
                <div className="text-center mb-12">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>
                    We Listen
                  </p>
                  <h2 className="text-4xl font-bold text-gray-900">Share Your Thoughts</h2>
                  <p className="mt-3 text-gray-500">Your feedback helps us create exceptional experiences</p>
                </div>
                <ContactForm
                  slug={tenant.slug}
                  primaryColor={primary}
                  accentColor={accent}
                  currency={tenant.currency}
                />
              </div>
            </section>
          ),
        }
        const order = orderSections(LUXE_SECTION_ORDER, website.sectionOrder)
        return order.map(id => <React.Fragment key={id}>{nodes[id]}</React.Fragment>)
      })()}

      <FooterSection data={data} scrollTo={scrollTo} />

      {/* ── WhatsApp floating button ──────────────────────── */}
      <WhatsAppButton whatsappNumber={website?.whatsappNumber} />

      {/* ── Modals ────────────────────────────────────────── */}
      {bookingRoom && (
        <BookingModal
          room={bookingRoom}
          data={data}
          onClose={() => setBookingRoom(null)}
        />
      )}

      {selectedRoom && (
        <RoomModal
          room={selectedRoom}
          currency={tenant.currency}
          primaryColor={primary}
          accentColor={accent}
          onClose={() => setSelectedRoom(null)}
          onBook={(room) => {
            setSelectedRoom(null)
            setBookingRoom(room)
          }}
        />
      )}
    </div>
  )
}
