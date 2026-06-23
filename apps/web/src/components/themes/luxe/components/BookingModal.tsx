'use client'
import { useState, useEffect } from 'react'
import { X, Calendar, CheckCircle, Minus, Plus } from 'lucide-react'
import type { ResortData, ResortRoom } from '../../types'
import { fmt } from '../utils'

const ROOM_TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Standard Room', DELUXE: 'Deluxe Room', SUITE: 'Suite',
  VILLA: 'Villa', PENTHOUSE: 'Penthouse', BUNGALOW: 'Bungalow',
  FAMILY: 'Family Room', TWIN: 'Twin Room',
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface BookingModalProps {
  room:    ResortRoom
  data:    ResortData
  onClose: () => void
}

export function BookingModal({ room, data, onClose }: BookingModalProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '#1a6b5e'
  const accent  = website?.accentColor  || '#d4a853'
  const slug    = tenant.slug

  const [step, setStep]                     = useState<'dates' | 'details' | 'success'>('dates')
  const [checkIn,  setCheckIn]              = useState('')
  const [checkOut, setCheckOut]             = useState('')
  const [adults,   setAdults]               = useState(2)
  const [children, setChildren]             = useState(0)
  const [checkingAvail, setCheckingAvail]   = useState(false)
  const [form, setForm]                     = useState({ firstName: '', lastName: '', email: '', phone: '', specialRequests: '' })
  const [submitting, setSubmitting]         = useState(false)
  const [confirmation, setConfirmation]     = useState<{ confirmationNo: string; totalAmount: number; nights: number } | null>(null)
  const [error, setError]                   = useState('')

  const today  = new Date().toISOString().split('T')[0]
  const nights = checkIn && checkOut
    ? Math.max(0, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))
    : 0
  const total  = nights * Number(room.basePrice)

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Keyboard close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const checkAvailability = async () => {
    if (!checkIn || !checkOut || nights <= 0) {
      setError('Please select valid check-in and check-out dates')
      return
    }
    setError(''); setCheckingAvail(true)
    try {
      const res  = await fetch(`${API}/site/${slug}/availability?checkIn=${checkIn}&checkOut=${checkOut}`)
      const json = await res.json()
      const avail: ResortRoom[] = json.data || []
      if (avail.some(r => r.id === room.id)) {
        setStep('details')
      } else {
        setError('Sorry, this room is not available for your selected dates. Please try different dates.')
      }
    } catch {
      setError('Failed to check availability. Please try again.')
    }
    setCheckingAvail(false)
  }

  const submitBooking = async () => {
    if (!form.firstName || !form.lastName || !form.email) {
      setError('Please fill in all required fields')
      return
    }
    setError(''); setSubmitting(true)
    try {
      const res  = await fetch(`${API}/site/${slug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, roomId: room.id, checkIn, checkOut, adults, children }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Booking failed'); setSubmitting(false); return }
      setConfirmation(json.data)
      setStep('success')
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setSubmitting(false)
  }

  const GuestCounter = ({ label, sub, val, onDec, onInc, disableDec, disableInc }: {
    label: string; sub: string; val: number
    onDec: () => void; onInc: () => void; disableDec: boolean; disableInc: boolean
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={onDec} disabled={disableDec}
          className="h-9 w-9 rounded-full border-2 flex items-center justify-center transition-all disabled:opacity-30"
          style={{ borderColor: disableDec ? '#e5e7eb' : primary }}>
          <Minus className="h-3.5 w-3.5" style={{ color: disableDec ? '#d1d5db' : primary }} />
        </button>
        <span className="w-5 text-center font-bold text-sm text-gray-900">{val}</span>
        <button onClick={onInc} disabled={disableInc}
          className="h-9 w-9 rounded-full border-2 flex items-center justify-center transition-all disabled:opacity-30"
          style={{ borderColor: disableInc ? '#e5e7eb' : primary }}>
          <Plus className="h-3.5 w-3.5" style={{ color: disableInc ? '#d1d5db' : primary }} />
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-in panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-3">
            <button onClick={onClose}
              className="h-9 w-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
              <X className="h-4 w-4 text-gray-600" />
            </button>
            <h3 className="font-semibold text-gray-900 text-base">
              {step === 'dates'   ? 'Select dates & guests' :
               step === 'details' ? 'Your details' :
               'Booking confirmed!'}
            </h3>
          </div>
          {step !== 'success' && (
            <div className="flex items-center gap-1.5">
              {(['dates', 'details'] as const).map(s => (
                <div key={s} className="h-2 rounded-full transition-all duration-300"
                  style={{ width: step === s ? '20px' : '8px', backgroundColor: step === s ? primary : '#d1d5db' }} />
              ))}
            </div>
          )}
        </div>

        {/* Room summary strip */}
        {step !== 'success' && (
          <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ backgroundColor: `${primary}06` }}>
            {room.images[0] && (
              <img src={room.images[0]} alt={room.name} className="h-14 w-20 object-cover rounded-xl flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">{room.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {ROOM_TYPE_LABELS[room.type] ?? room.type} · Up to {room.maxOccupancy} guests
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-bold text-base" style={{ color: primary }}>{fmt(Number(room.basePrice), tenant.currency)}</p>
              <p className="text-xs text-gray-400">/ night</p>
            </div>
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* STEP 1: Dates & Guests */}
          {step === 'dates' && (
            <div className="p-6 space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">When are you staying?</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Check-in</label>
                    <input type="date" value={checkIn} min={today}
                      onChange={e => { setCheckIn(e.target.value); setError('') }}
                      className="w-full rounded-xl border-2 px-3 py-3 text-sm focus:outline-none transition-colors"
                      style={{ borderColor: checkIn ? primary : '#e5e7eb' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Check-out</label>
                    <input type="date" value={checkOut} min={checkIn || today}
                      onChange={e => { setCheckOut(e.target.value); setError('') }}
                      className="w-full rounded-xl border-2 px-3 py-3 text-sm focus:outline-none transition-colors"
                      style={{ borderColor: checkOut ? primary : '#e5e7eb' }} />
                  </div>
                </div>
              </div>

              {nights > 0 && (
                <div className="rounded-2xl p-4 space-y-2" style={{ backgroundColor: `${primary}08` }}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      {fmt(Number(room.basePrice), tenant.currency)} × {nights} night{nights !== 1 ? 's' : ''}
                    </span>
                    <span className="text-lg font-bold" style={{ color: primary }}>{fmt(total, tenant.currency)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-200">
                    <span>✓ Check-in after {tenant.checkInTime}</span>
                    <span>✓ Check-out by {tenant.checkOutTime}</span>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Who's coming?</p>
                <div className="rounded-2xl border-2 border-gray-100 px-4 divide-y divide-gray-100">
                  <GuestCounter
                    label="Adults" sub="Age 13+"
                    val={adults}
                    onDec={() => setAdults(a => Math.max(1, a - 1))}
                    onInc={() => setAdults(a => Math.min(room.maxOccupancy, a + 1))}
                    disableDec={adults <= 1}
                    disableInc={adults + children >= room.maxOccupancy}
                  />
                  <GuestCounter
                    label="Children" sub="Ages 2–12"
                    val={children}
                    onDec={() => setChildren(c => Math.max(0, c - 1))}
                    onInc={() => setChildren(c => Math.min(room.maxOccupancy - adults, c + 1))}
                    disableDec={children <= 0}
                    disableInc={adults + children >= room.maxOccupancy}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2 pl-1">Maximum {room.maxOccupancy} guests for this room</p>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0">⚠️</span> {error}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Guest Details */}
          {step === 'details' && (
            <div className="p-6 space-y-5">
              <div className="rounded-2xl border-2 border-gray-100 overflow-hidden">
                <div className="px-4 py-3" style={{ backgroundColor: `${primary}08` }}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Your booking</p>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {[
                    { label: 'Check-in',  value: new Date(checkIn).toLocaleDateString('en-US',  { weekday: 'short', month: 'short', day: 'numeric' }) },
                    { label: 'Check-out', value: new Date(checkOut).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) },
                    { label: 'Guests',    value: `${adults} adult${adults !== 1 ? 's' : ''}${children > 0 ? `, ${children} child${children !== 1 ? 'ren' : ''}` : ''}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-semibold">{value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-sm text-gray-600">{fmt(Number(room.basePrice), tenant.currency)} × {nights} nights</span>
                    <span className="text-xl font-bold" style={{ color: primary }}>{fmt(total, tenant.currency)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Your information</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'firstName', label: 'First Name *', ph: 'John' },
                    { key: 'lastName',  label: 'Last Name *',  ph: 'Smith' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">{f.label}</label>
                      <input
                        value={form[f.key as keyof typeof form]}
                        onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.ph}
                        className="w-full rounded-xl border-2 px-3 py-2.5 text-sm focus:outline-none transition-colors"
                        style={{ borderColor: form[f.key as keyof typeof form] ? primary : '#e5e7eb' }}
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Email *</label>
                  <input type="email" value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="john@example.com"
                    className="w-full rounded-xl border-2 px-3 py-2.5 text-sm focus:outline-none transition-colors"
                    style={{ borderColor: form.email ? primary : '#e5e7eb' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Phone</label>
                  <input value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+1 234 567 8900"
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:outline-none transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Special Requests</label>
                  <textarea value={form.specialRequests}
                    onChange={e => setForm(p => ({ ...p, specialRequests: e.target.value }))}
                    rows={2} placeholder="Dietary needs, early check-in, special occasions…"
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:outline-none resize-none transition-colors" />
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">⚠️ {error}</div>
              )}
            </div>
          )}

          {/* SUCCESS */}
          {step === 'success' && confirmation && (
            <div className="flex flex-col items-center justify-center text-center p-8 min-h-[500px]">
              <div className="relative mb-6">
                <div className="h-24 w-24 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${primary}15` }}>
                  <CheckCircle className="h-12 w-12" style={{ color: primary }} />
                </div>
                <div className="absolute -top-1 -right-1 h-8 w-8 rounded-full flex items-center justify-center text-lg"
                  style={{ backgroundColor: accent }}>
                  🎉
                </div>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-1">You're booked!</h3>
              <p className="text-gray-500 text-sm mb-6">We'll contact you shortly to finalise your stay.</p>

              <div className="w-full rounded-2xl p-5 mb-4" style={{ backgroundColor: `${primary}08` }}>
                <p className="text-xs text-gray-500 mb-1">Confirmation Number</p>
                <p className="text-3xl font-mono font-bold mb-4" style={{ color: primary }}>
                  {confirmation.confirmationNo}
                </p>
                <div className="space-y-2 text-sm border-t border-gray-200 pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Room</span>
                    <span className="font-medium text-right max-w-[60%] truncate text-gray-900">{room.name || room.type || 'Room'}</span>
                  </div>
                  {(() => {
                    const fmtDate = (d: string) => {
                      if (!d) return '—';
                      // Parse date-only strings as local time to avoid timezone off-by-one
                      const [y, m, day] = d.split('-').map(Number);
                      const dt = new Date(y, m - 1, day);
                      return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    };
                    const nightsVal = confirmation.nights ?? nights;
                    return [
                      { label: 'Check-in',  value: fmtDate(checkIn) },
                      { label: 'Check-out', value: fmtDate(checkOut) },
                      { label: 'Duration',  value: nightsVal > 0 ? `${nightsVal} night${nightsVal !== 1 ? 's' : ''}` : '—' },
                    ];
                  })().map(({ label, value }) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-medium text-gray-900">{value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="font-semibold text-gray-800">Total</span>
                    <span className="font-bold text-lg" style={{ color: primary }}>
                      {fmt(confirmation.totalAmount, tenant.currency)}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-400 mb-6">Confirmation sent to <strong>{form.email}</strong></p>

              <button onClick={onClose}
                className="w-full py-4 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90"
                style={{ backgroundColor: primary }}>
                Done
              </button>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        {step === 'dates' && (
          <div className="border-t bg-white px-6 py-4 space-y-2">
            <button onClick={checkAvailability}
              disabled={checkingAvail || nights <= 0}
              className="w-full py-4 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: primary }}>
              {checkingAvail
                ? <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Checking…</>
                : nights > 0
                  ? <><Calendar className="h-4 w-4" /> Reserve · {fmt(total, tenant.currency)}</>
                  : 'Select dates to continue'}
            </button>
            <p className="text-xs text-center text-gray-400">You won't be charged yet</p>
          </div>
        )}

        {step === 'details' && (
          <div className="border-t bg-white px-6 py-4 space-y-2">
            <button onClick={submitBooking} disabled={submitting}
              className="w-full py-4 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: primary }}>
              {submitting
                ? <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Confirming…</>
                : <>Confirm Booking · {fmt(total, tenant.currency)}</>}
            </button>
            <button onClick={() => { setStep('dates'); setError('') }}
              className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1">
              ← Change dates or guests
            </button>
          </div>
        )}
      </div>
    </>
  )
}
