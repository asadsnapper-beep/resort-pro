'use client';

import { useState, useEffect } from 'react';
import { Users, Send, CheckCircle, X, Car } from 'lucide-react';
import type { WidgetProps } from '../types';
import { galleryImg } from '../_utils/images';

interface Vehicle {
  id: string;
  type: string;
  name: string;
  capacity?: number;
  hourlyRate?: number;
  dailyRate?: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

function formatType(t: string) { return t.charAt(0) + t.slice(1).toLowerCase(); }

export function VehiclesWidget({ slug, primaryColor, accentColor, currency }: WidgetProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [enquiryVehicle, setEnquiryVehicle] = useState<Vehicle | null>(null);
  const [form, setForm]       = useState({ name: '', email: '', phone: '', preferredDate: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/site/${slug}/vehicles`)
      .then(r => r.json())
      .then(j => { setVehicles(j.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  const openEnquiry = (v: Vehicle) => {
    setEnquiryVehicle(v);
    setForm({ name: '', email: '', phone: '', preferredDate: '', message: '' });
    setSuccess(false); setError('');
  };

  const submitEnquiry = async () => {
    if (!form.name || !form.phone) { setError('Please share your name and phone number'); return; }
    setError(''); setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/site/${slug}/vehicle-enquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: enquiryVehicle!.id, name: form.name, email: form.email || undefined, phone: form.phone,
          preferredDate: form.preferredDate || undefined, message: form.message || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Failed to send enquiry'); setSubmitting(false); return; }
      setSuccess(true);
    } catch { setError('Something went wrong.'); }
    setSubmitting(false);
  };

  if (loading) return null;
  if (vehicles.length === 0) return null;

  return (
    <section id="vehicles" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: accentColor }}>
            Vehicle Rental
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900">Get Around With Ease</h2>
          <p className="mt-4 text-gray-500 max-w-xl mx-auto">
            Cars, bikes, scooties and cycles available to rent during your stay
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {vehicles.map((v, i) => (
            <div key={v.id}
              className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 flex flex-col">
              <div className="relative h-36 overflow-hidden flex-shrink-0">
                <img src={galleryImg(undefined, i)} alt={v.name} loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute top-3 left-3">
                  <span className="text-xs font-bold text-white px-2.5 py-1 rounded-full" style={{ backgroundColor: primaryColor + 'dd' }}>
                    {formatType(v.type)}
                  </span>
                </div>
              </div>
              <div className="p-4 flex flex-col flex-1">
                <h3 className="font-bold text-gray-900 text-sm leading-tight">{v.name}</h3>
                {v.capacity && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                    <Users className="h-3 w-3" /> {v.capacity} seats
                  </div>
                )}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                  <span className="text-sm font-bold" style={{ color: primaryColor }}>
                    {v.hourlyRate ? `${fmt(v.hourlyRate, currency)}/hr` : v.dailyRate ? `${fmt(v.dailyRate, currency)}/day` : 'Enquire'}
                  </span>
                  <button onClick={() => openEnquiry(v)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold text-white hover:opacity-90 hover:scale-105 transition-all"
                    style={{ backgroundColor: primaryColor }}>
                    Enquire
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {enquiryVehicle && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setEnquiryVehicle(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: primaryColor }}>
                <div className="flex items-center gap-2 text-white">
                  <Car className="h-5 w-5" />
                  <h3 className="font-bold">{enquiryVehicle.name}</h3>
                </div>
                <button onClick={() => setEnquiryVehicle(null)} className="text-white/80 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6">
                {success ? (
                  <div className="text-center py-6">
                    <div className="h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: primaryColor + '20' }}>
                      <CheckCircle className="h-7 w-7" style={{ color: primaryColor }} />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900">Enquiry Sent!</h4>
                    <p className="text-gray-500 mt-2 text-sm">We&apos;ll get back to you shortly.</p>
                    <button onClick={() => setEnquiryVehicle(null)} className="mt-6 px-6 py-2.5 rounded-full text-white font-semibold text-sm" style={{ backgroundColor: primaryColor }}>
                      Close
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Your Name *</label>
                      <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Phone *</label>
                        <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
                        <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Preferred Date</label>
                      <input type="date" value={form.preferredDate} onChange={e => setForm(f => ({ ...f, preferredDate: e.target.value }))}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Message</label>
                      <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={2}
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none" />
                    </div>
                    {error && <p className="text-red-500 text-xs">{error}</p>}
                    <button onClick={submitEnquiry} disabled={submitting}
                      className="w-full py-3.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
                      style={{ backgroundColor: primaryColor }}>
                      {submitting ? 'Sending...' : <><Send className="h-4 w-4" /> Send Enquiry</>}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
