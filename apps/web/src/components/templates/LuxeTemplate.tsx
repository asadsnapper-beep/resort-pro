'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Star, Phone, Mail, MapPin, ChevronDown, Bed, Users, Calendar,
  ArrowRight, CheckCircle, Menu, X, MessageSquare, Send,
  Wifi, Car, Coffee, Waves, Dumbbell, Utensils, Shield, Wind,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Room {
  id: string; name: string; type: string; number: string;
  basePrice: number; maxOccupancy: number; images: string[];
  amenities: string[]; description?: string;
}

interface ResortData {
  tenant: {
    name: string; slug: string; phone?: string; email?: string;
    address?: string; currency: string; checkInTime: string; checkOutTime: string; logoUrl?: string;
  };
  website: {
    heroTitle: string; heroSubtitle?: string; heroImage?: string;
    aboutTitle?: string; aboutText?: string; aboutImage?: string;
    galleryImages?: string[];
    testimonials?: { name: string; text: string; rating: number; avatar?: string }[];
    primaryColor?: string; accentColor?: string;
  };
  rooms: Room[];
}

/* ── Amenity icon map ───────────────────────────────────────────────────────── */
const AMENITY_ICONS: Record<string, React.ElementType> = {
  wifi: Wifi, parking: Car, breakfast: Coffee, pool: Waves,
  gym: Dumbbell, restaurant: Utensils, security: Shield, ac: Wind,
};

function AmenityIcon({ amenity }: { amenity: string }) {
  const lower = amenity.toLowerCase();
  const Icon = Object.entries(AMENITY_ICONS).find(([k]) => lower.includes(k))?.[1] ?? CheckCircle;
  return <Icon className="h-3.5 w-3.5" />;
}

/* ── Currency formatter ─────────────────────────────────────────────────────── */
function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

/* ── Booking Form ────────────────────────────────────────────────────────────── */
function BookingSection({ data }: { data: ResortData }) {
  const { tenant, rooms } = data;
  const slug = tenant.slug;
  const primary = data.website.primaryColor || '#1a6b5e';
  const accent = data.website.accentColor || '#d4a853';

  const [step, setStep] = useState<'dates' | 'rooms' | 'details' | 'success'>('dates');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(2);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', specialRequests: '' });
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ confirmationNo: string; totalAmount: number; nights: number } | null>(null);
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const checkAvailability = async () => {
    if (!checkIn || !checkOut) { setError('Please select dates'); return; }
    setError(''); setLoadingRooms(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/site/${slug}/availability?checkIn=${checkIn}&checkOut=${checkOut}`);
      const json = await res.json();
      setAvailableRooms(json.data || []);
      setStep('rooms');
    } catch { setError('Failed to check availability'); }
    setLoadingRooms(false);
  };

  const submitBooking = async () => {
    if (!selectedRoom || !form.firstName || !form.lastName || !form.email) { setError('Please fill all required fields'); return; }
    setError(''); setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/site/${slug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, roomId: selectedRoom.id, checkIn, checkOut, adults }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Booking failed'); setSubmitting(false); return; }
      setConfirmation(json.data);
      setStep('success');
    } catch { setError('Something went wrong. Please try again.'); }
    setSubmitting(false);
  };

  return (
    <section id="booking" className="py-24 bg-gray-50">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>Reserve</p>
          <h2 className="text-4xl font-bold text-gray-900">Book Your Stay</h2>
          <p className="mt-3 text-gray-500">Check-in: {tenant.checkInTime} · Check-out: {tenant.checkOutTime}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* Step Indicator */}
          <div className="flex border-b">
            {[
              { id: 'dates', label: '1. Dates' },
              { id: 'rooms', label: '2. Room' },
              { id: 'details', label: '3. Details' },
            ].map(({ id, label }) => (
              <div key={id} className="flex-1 py-4 text-center text-sm font-medium transition-colors"
                style={{
                  borderBottom: step === id ? `3px solid ${primary}` : '3px solid transparent',
                  color: step === id ? primary : '#9ca3af',
                }}>
                {label}
              </div>
            ))}
          </div>

          <div className="p-8">
            {/* Step 1: Dates */}
            {step === 'dates' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Check-In Date</label>
                    <input type="date" value={checkIn} min={today} onChange={e => setCheckIn(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
                      style={{ '--tw-ring-color': primary } as React.CSSProperties} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Check-Out Date</label>
                    <input type="date" value={checkOut} min={checkIn || today} onChange={e => setCheckOut(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
                      style={{ '--tw-ring-color': primary } as React.CSSProperties} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Guests</label>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setAdults(Math.max(1, adults - 1))}
                      className="h-10 w-10 rounded-full border border-gray-200 flex items-center justify-center text-lg hover:bg-gray-50 transition-colors">−</button>
                    <span className="text-lg font-semibold w-8 text-center">{adults}</span>
                    <button onClick={() => setAdults(Math.min(10, adults + 1))}
                      className="h-10 w-10 rounded-full border border-gray-200 flex items-center justify-center text-lg hover:bg-gray-50 transition-colors">+</button>
                    <span className="text-sm text-gray-500">{adults === 1 ? '1 adult' : `${adults} adults`}</span>
                  </div>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button onClick={checkAvailability} disabled={loadingRooms}
                  className="w-full py-4 rounded-xl text-white font-semibold text-sm tracking-wide transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: primary }}>
                  {loadingRooms ? 'Checking...' : <><Calendar className="h-4 w-4" /> Check Availability</>}
                </button>
              </div>
            )}

            {/* Step 2: Room Selection */}
            {step === 'rooms' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-500">{availableRooms.length} room{availableRooms.length !== 1 ? 's' : ''} available</p>
                  <button onClick={() => setStep('dates')} className="text-sm underline text-gray-400 hover:text-gray-600">← Change dates</button>
                </div>
                {availableRooms.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 font-medium">No rooms available for these dates</p>
                    <button onClick={() => setStep('dates')} className="mt-3 text-sm underline" style={{ color: primary }}>Try different dates</button>
                  </div>
                ) : (
                  availableRooms.map(room => {
                    const nights = checkIn && checkOut ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000) : 1;
                    const isSelected = selectedRoom?.id === room.id;
                    return (
                      <div key={room.id} onClick={() => setSelectedRoom(room)}
                        className="rounded-2xl border-2 p-4 cursor-pointer transition-all hover:shadow-md"
                        style={{ borderColor: isSelected ? primary : '#e5e7eb', backgroundColor: isSelected ? `${primary}08` : 'white' }}>
                        <div className="flex gap-4">
                          {room.images[0] && (
                            <img src={room.images[0]} alt={room.name} className="w-24 h-20 object-cover rounded-xl flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-gray-900">{room.name}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{room.type.replace('_', ' ')} · Up to {room.maxOccupancy} guests</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-bold text-lg" style={{ color: primary }}>{fmt(Number(room.basePrice), tenant.currency)}</p>
                                <p className="text-xs text-gray-400">per night</p>
                                {nights > 1 && <p className="text-xs font-medium text-gray-600 mt-0.5">{fmt(Number(room.basePrice) * nights, tenant.currency)} total</p>}
                              </div>
                            </div>
                            {room.amenities.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {room.amenities.slice(0, 4).map(a => (
                                  <span key={a} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-gray-100 text-gray-600">
                                    <AmenityIcon amenity={a} /> {a}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="mt-3 pt-3 border-t flex items-center justify-between">
                            <span className="text-xs font-semibold" style={{ color: primary }}>✓ Selected</span>
                            <button onClick={(e) => { e.stopPropagation(); setStep('details'); }}
                              className="text-sm font-semibold text-white px-4 py-1.5 rounded-lg transition-all hover:opacity-90"
                              style={{ backgroundColor: primary }}>
                              Continue →
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Step 3: Guest Details */}
            {step === 'details' && selectedRoom && (
              <div className="space-y-5">
                <div className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: `${primary}10` }}>
                  <Bed className="h-5 w-5 flex-shrink-0" style={{ color: primary }} />
                  <div>
                    <p className="font-semibold text-sm">{selectedRoom.name}</p>
                    <p className="text-xs text-gray-500">{checkIn} → {checkOut} · {adults} guest{adults !== 1 ? 's' : ''}</p>
                  </div>
                  <button onClick={() => setStep('rooms')} className="ml-auto text-xs underline text-gray-400">Change</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[{ key: 'firstName', label: 'First Name', ph: 'John' }, { key: 'lastName', label: 'Last Name', ph: 'Smith' }].map(f => (
                    <div key={f.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{f.label} *</label>
                      <input value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.ph} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                    <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="john@example.com" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                    <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+1 234 567 8900" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Special Requests</label>
                  <textarea value={form.specialRequests} onChange={e => setForm(p => ({ ...p, specialRequests: e.target.value }))}
                    rows={2} placeholder="Dietary needs, room preferences, celebrations..."
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 resize-none" />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button onClick={submitBooking} disabled={submitting}
                  className="w-full py-4 rounded-xl text-white font-semibold text-sm tracking-wide transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: primary }}>
                  {submitting ? 'Confirming...' : `Confirm Booking · ${fmt(Number(selectedRoom.basePrice) * Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)), tenant.currency)}`}
                </button>
              </div>
            )}

            {/* Success */}
            {step === 'success' && confirmation && (
              <div className="text-center py-8">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-4" style={{ backgroundColor: `${primary}15` }}>
                  <CheckCircle className="h-8 w-8" style={{ color: primary }} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Booking Confirmed!</h3>
                <p className="mt-2 text-gray-500">We'll contact you shortly to finalize your reservation.</p>
                <div className="mt-6 rounded-2xl p-5 text-left space-y-2" style={{ backgroundColor: `${primary}08` }}>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Confirmation #</span><span className="font-mono font-bold" style={{ color: primary }}>{confirmation.confirmationNo}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Nights</span><span className="font-medium">{confirmation.nights}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Total</span><span className="font-bold text-lg">{fmt(confirmation.totalAmount, tenant.currency)}</span></div>
                </div>
                <button onClick={() => { setStep('dates'); setCheckIn(''); setCheckOut(''); setSelectedRoom(null); setConfirmation(null); setForm({ firstName: '', lastName: '', email: '', phone: '', specialRequests: '' }); }}
                  className="mt-6 text-sm underline" style={{ color: primary }}>
                  Make another reservation
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Feedback Section ─────────────────────────────────────────────────────── */
function FeedbackSection({ data }: { data: ResortData }) {
  const { tenant } = data;
  const primary = data.website.primaryColor || '#1a6b5e';
  const accent = data.website.accentColor || '#d4a853';
  const [type, setType] = useState<'FEEDBACK' | 'COMPLAINT' | 'REQUEST' | 'OTHER'>('FEEDBACK');
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.subject || !form.message) { setError('Please fill all fields'); return; }
    setError(''); setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/site/${tenant.slug}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, type }),
      });
      if (res.ok) { setSent(true); }
      else { const j = await res.json(); setError(j.error || 'Submission failed'); }
    } catch { setError('Something went wrong.'); }
    setSubmitting(false);
  };

  return (
    <section id="feedback" className="py-24 bg-white">
      <div className="max-w-2xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>We Listen</p>
          <h2 className="text-4xl font-bold text-gray-900">Share Your Thoughts</h2>
          <p className="mt-3 text-gray-500">Your feedback helps us create exceptional experiences</p>
        </div>

        {sent ? (
          <div className="text-center py-16 rounded-3xl border-2 border-dashed border-gray-200">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-4" style={{ backgroundColor: `${primary}15` }}>
              <Send className="h-7 w-7" style={{ color: primary }} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Thank you!</h3>
            <p className="mt-2 text-gray-500">Our team will review your message and respond promptly.</p>
            <button onClick={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }); }}
              className="mt-6 text-sm font-medium underline" style={{ color: primary }}>Send another message</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5 bg-gray-50 rounded-3xl p-8">
            {/* Type Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <div className="grid grid-cols-4 gap-2">
                {([
                  { v: 'FEEDBACK', label: '💬 Feedback' },
                  { v: 'COMPLAINT', label: '⚠️ Complaint' },
                  { v: 'REQUEST', label: '🙏 Request' },
                  { v: 'OTHER', label: '📝 Other' },
                ] as const).map(opt => (
                  <button key={opt.v} type="button" onClick={() => setType(opt.v)}
                    className="py-2.5 rounded-xl text-xs font-medium border-2 transition-all"
                    style={{
                      borderColor: type === opt.v ? primary : '#e5e7eb',
                      backgroundColor: type === opt.v ? `${primary}10` : 'white',
                      color: type === opt.v ? primary : '#6b7280',
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Jane Doe" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="jane@example.com" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject *</label>
              <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                placeholder="Brief subject of your message" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Message *</label>
              <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                rows={5} placeholder="Tell us about your experience or request in detail..."
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 resize-none" />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" disabled={submitting}
              className="w-full py-4 rounded-xl text-white font-semibold text-sm tracking-wide flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: primary }}>
              {submitting ? 'Sending...' : <><Send className="h-4 w-4" /> Send Message</>}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

/* ── Main Luxe Template ─────────────────────────────────────────────────────── */
export function LuxeTemplate({ data }: { data: ResortData }) {
  const { tenant, website, rooms } = data;
  const primary = website.primaryColor || '#1a6b5e';
  const accent = website.accentColor || '#d4a853';
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems = [
    { id: 'about', label: 'About' },
    { id: 'rooms', label: 'Rooms' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'booking', label: 'Book Now' },
    { id: 'feedback', label: 'Contact' },
  ].filter(item => {
    if (item.id === 'gallery') return (website.galleryImages ?? []).length > 0;
    return true;
  });

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setNavOpen(false);
    setActiveSection(id);
  };

  return (
    <div className="font-sans antialiased" style={{ '--primary': primary, '--accent': accent } as React.CSSProperties}>

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <div className="flex items-center gap-3">
            {tenant.logoUrl
              ? <img src={tenant.logoUrl} alt={tenant.name} className="h-8 w-auto" />
              : <span className="text-xl font-bold" style={{ color: scrolled ? primary : 'white' }}>{tenant.name}</span>
            }
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map(item => (
              <button key={item.id} onClick={() => scrollTo(item.id)}
                className={`text-sm font-medium transition-colors ${item.id === 'booking' ? 'text-white px-5 py-2 rounded-full' : `${scrolled ? 'text-gray-600 hover:text-gray-900' : 'text-white/80 hover:text-white'}`}`}
                style={item.id === 'booking' ? { backgroundColor: accent } : {}}>
                {item.label}
              </button>
            ))}
          </div>

          {/* Mobile menu */}
          <button onClick={() => setNavOpen(!navOpen)} className="md:hidden" style={{ color: scrolled ? '#374151' : 'white' }}>
            {navOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {navOpen && (
          <div className="md:hidden bg-white border-t shadow-lg px-6 py-4 space-y-3">
            {navItems.map(item => (
              <button key={item.id} onClick={() => scrollTo(item.id)}
                className="block w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900 py-2">
                {item.label}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section id="hero" className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
        {website.heroImage ? (
          <>
            <div className="absolute inset-0">
              <img src={website.heroImage} alt={website.heroTitle} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
            </div>
          </>
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primary} 0%, #0d4037 50%, #071f1c 100%)` }} />
        )}

        <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] mb-6 opacity-80" style={{ color: accent }}>
            {tenant.name}
          </p>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">{website.heroTitle}</h1>
          {website.heroSubtitle && (
            <p className="text-xl md:text-2xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed">{website.heroSubtitle}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => scrollTo('booking')}
              className="px-8 py-4 rounded-full font-semibold text-sm tracking-wide transition-all hover:scale-105 shadow-lg"
              style={{ backgroundColor: accent, color: '#1a1a1a' }}>
              Book Your Stay <ArrowRight className="inline h-4 w-4 ml-1" />
            </button>
            <button onClick={() => scrollTo('rooms')}
              className="px-8 py-4 rounded-full font-semibold text-sm tracking-wide border-2 border-white/40 text-white backdrop-blur-sm hover:bg-white/10 transition-all">
              Explore Rooms
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <button onClick={() => scrollTo('about')}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 animate-bounce">
          <ChevronDown className="h-8 w-8" />
        </button>
      </section>

      {/* ── About ────────────────────────────────────────────────────────────── */}
      <section id="about" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: accent }}>
                Our Story
              </p>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                {website.aboutTitle || `Welcome to ${tenant.name}`}
              </h2>
              <p className="text-lg text-gray-500 leading-relaxed mb-8">
                {website.aboutText || 'Experience unparalleled luxury and comfort in our world-class resort, where every detail is crafted to make your stay unforgettable.'}
              </p>
              <div className="grid grid-cols-3 gap-6">
                {[
                  { label: 'Check-In', value: tenant.checkInTime || '14:00' },
                  { label: 'Check-Out', value: tenant.checkOutTime || '11:00' },
                  { label: 'Rooms', value: `${rooms.length}+` },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center p-4 rounded-2xl" style={{ backgroundColor: `${primary}08` }}>
                    <p className="text-2xl font-bold" style={{ color: primary }}>{value}</p>
                    <p className="text-xs text-gray-500 mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              {website.aboutImage ? (
                <img src={website.aboutImage} alt="About" className="w-full h-96 object-cover rounded-3xl shadow-2xl" />
              ) : (
                <div className="w-full h-96 rounded-3xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primary}20, ${accent}20)` }}>
                  <p className="text-gray-400">About image</p>
                </div>
              )}
              {/* Floating badge */}
              <div className="absolute -bottom-6 -left-6 rounded-2xl p-4 shadow-xl bg-white">
                <div className="flex items-center gap-2">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" style={{ color: accent }} />)}
                </div>
                <p className="text-xs font-medium text-gray-700 mt-1">5-Star Experience</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Rooms ────────────────────────────────────────────────────────────── */}
      <section id="rooms" className="py-24" style={{ backgroundColor: `${primary}05` }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>Accommodations</p>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900">Rooms & Villas</h2>
            <p className="mt-4 text-gray-500 max-w-xl mx-auto">Each space is designed to offer the perfect blend of luxury and comfort</p>
          </div>

          {rooms.length === 0 ? (
            <div className="text-center py-16 text-gray-400">Rooms coming soon</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {rooms.map((room) => (
                <div key={room.id} className="group bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                  <div className="relative h-56 overflow-hidden">
                    {room.images[0] ? (
                      <img src={room.images[0]} alt={room.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${primary}15` }}>
                        <Bed className="h-12 w-12 opacity-30" style={{ color: primary }} />
                      </div>
                    )}
                    <div className="absolute top-4 left-4">
                      <span className="text-xs font-semibold text-white px-3 py-1 rounded-full backdrop-blur-sm" style={{ backgroundColor: `${primary}CC` }}>
                        {room.type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{room.name}</h3>
                    {room.description && <p className="text-sm text-gray-500 mb-4 line-clamp-2">{room.description}</p>}

                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                      <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {room.maxOccupancy} guests</span>
                    </div>

                    {room.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-5">
                        {room.amenities.slice(0, 4).map(a => (
                          <span key={a} className="inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1" style={{ backgroundColor: `${primary}10`, color: primary }}>
                            <AmenityIcon amenity={a} /> {a}
                          </span>
                        ))}
                        {room.amenities.length > 4 && (
                          <span className="text-xs text-gray-400">+{room.amenities.length - 4} more</span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div>
                        <span className="text-2xl font-bold" style={{ color: primary }}>{fmt(Number(room.basePrice), tenant.currency)}</span>
                        <span className="text-sm text-gray-400"> / night</span>
                      </div>
                      <button onClick={() => scrollTo('booking')}
                        className="px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90 hover:scale-105"
                        style={{ backgroundColor: primary }}>
                        Book Now
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Gallery ──────────────────────────────────────────────────────────── */}
      {(website.galleryImages ?? []).length > 0 && (
        <section id="gallery" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>Gallery</p>
              <h2 className="text-4xl font-bold text-gray-900">Visual Journey</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {(website.galleryImages ?? []).map((img, i) => (
                <div key={i} className={`overflow-hidden rounded-2xl ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
                  <img src={img} alt={`Gallery ${i + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    style={{ height: i === 0 ? '400px' : '190px' }} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Testimonials ─────────────────────────────────────────────────────── */}
      {(website.testimonials ?? []).length > 0 && (
        <section className="py-24" style={{ backgroundColor: `${primary}05` }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>Reviews</p>
              <h2 className="text-4xl font-bold text-gray-900">Guest Experiences</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(website.testimonials ?? []).map((t, i) => (
                <div key={i} className="bg-white rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className={`h-4 w-4 ${j < t.rating ? 'fill-current' : 'text-gray-200'}`}
                        style={{ color: j < t.rating ? accent : undefined }} />
                    ))}
                  </div>
                  <p className="text-gray-600 italic leading-relaxed mb-5">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    {t.avatar ? (
                      <img src={t.avatar} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                        style={{ backgroundColor: primary }}>
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Booking ──────────────────────────────────────────────────────────── */}
      <BookingSection data={data} />

      {/* ── Feedback ─────────────────────────────────────────────────────────── */}
      <FeedbackSection data={data} />

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="py-16 text-white" style={{ backgroundColor: primary }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            <div>
              <p className="text-xl font-bold mb-4">{tenant.name}</p>
              <p className="text-white/60 text-sm leading-relaxed">
                {website.aboutText?.substring(0, 120) || 'Experience luxury at its finest.'}
                {(website.aboutText?.length ?? 0) > 120 ? '...' : ''}
              </p>
            </div>
            <div>
              <p className="font-semibold text-white/80 mb-4 text-sm uppercase tracking-wider">Quick Links</p>
              <div className="space-y-2">
                {navItems.map(item => (
                  <button key={item.id} onClick={() => scrollTo(item.id)}
                    className="block text-sm text-white/60 hover:text-white transition-colors">{item.label}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="font-semibold text-white/80 mb-4 text-sm uppercase tracking-wider">Contact</p>
              <div className="space-y-3 text-sm text-white/60">
                {tenant.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 flex-shrink-0" />{tenant.phone}</p>}
                {tenant.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4 flex-shrink-0" />{tenant.email}</p>}
                {tenant.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 flex-shrink-0" />{tenant.address}</p>}
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-xs">© {new Date().getFullYear()} {tenant.name}. All rights reserved.</p>
            <p className="text-white/30 text-xs">Powered by ResortPro</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
