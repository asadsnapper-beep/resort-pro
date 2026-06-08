'use client'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'

import type { ThemeProps, ResortRoom } from '../types'
import {
  HeroSection, AboutSection, RoomsSection,
  AvailabilitySection, BookingSection,
  ContactSection, FooterSection,
} from './sections'
import { WhatsAppButton } from '../_widgets/SocialLinks'
import { MenuWidget } from '../_widgets'

const NAV_ITEMS = [
  { id: 'about',        label: 'About' },
  { id: 'rooms',        label: 'Rooms' },
  { id: 'menu',         label: 'Menu' },
  { id: 'availability', label: 'Availability' },
  { id: 'booking',      label: 'Book' },
  { id: 'contact',      label: 'Contact' },
]

export function MinimalTheme({ data }: ThemeProps) {
  const { tenant, website } = data
  if (!website) return null

  const primary = website.primaryColor || '#2563eb'

  /* ── Nav state ─────────────────────────── */
  const [navOpen,  setNavOpen]  = useState(false)
  const [scrolled, setScrolled] = useState(false)

  /* ── Calendar → Booking pre-fill ──────── */
  const [calendarCheckIn,  setCalendarCheckIn]  = useState<string | undefined>()
  const [calendarCheckOut, setCalendarCheckOut] = useState<string | undefined>()
  const [calendarRoomId,   setCalendarRoomId]   = useState<string | undefined>()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
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

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased">

      {/* ── Navbar ──────────────────────────── */}
      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-200 ${
        scrolled ? 'bg-white border-b border-slate-200' : 'bg-transparent'
      }`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

          {/* Logo / name */}
          <button onClick={() => scrollTo('hero')} className="flex items-center gap-3">
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.name} className="h-8 w-auto object-contain" />
            ) : (
              <span className={`text-base font-bold tracking-tight transition-colors ${
                scrolled ? 'text-slate-900' : 'text-white'
              }`}>
                {tenant.name}
              </span>
            )}
          </button>

          {/* Desktop links */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={`text-sm font-medium transition-colors ${
                  item.id === 'booking'
                    ? 'px-4 py-2 rounded-sm text-white'
                    : scrolled
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-white/70 hover:text-white'
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
            {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {navOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 px-6 py-4 space-y-1">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="block w-full text-left text-sm text-slate-700 hover:text-slate-900 py-2.5 border-b border-slate-50 last:border-0">
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── Sections ────────────────────────── */}
      <main>
        {(() => {
          const h = new Set(website.hiddenSections ?? [])
          const show = (id: string) => !h.has(id)
          return (
            <>
              <HeroSection   data={data} scrollTo={scrollTo} />
              {show('about')        && <AboutSection  data={data} />}
              <RoomsSection  data={data} onBookRoom={handleBookRoom} />
              {show('menu')         && <MenuWidget slug={tenant.slug} primaryColor={primary} accentColor={website.accentColor || '#3b82f6'} currency={tenant.currency} />}
              {show('availability') && <AvailabilitySection data={data} onRoomSelect={handleRoomSelect} />}
              <BookingSection data={data} initialCheckIn={calendarCheckIn} initialCheckOut={calendarCheckOut} initialRoomId={calendarRoomId} />
              {show('contact')      && <ContactSection data={data} />}
              <FooterSection  data={data} scrollTo={scrollTo} />
            </>
          )
        })()}
      </main>
      <WhatsAppButton whatsappNumber={data.website?.whatsappNumber} />
    </div>
  )
}
