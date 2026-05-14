'use client'
import { Phone, Mail, MapPin } from 'lucide-react'
import { ContactForm } from '../../_widgets'
import type { ResortData } from '../../types'

interface ContactSectionProps {
  data: ResortData
}

export function ContactSection({ data }: ContactSectionProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '#0891b2'
  const accent  = website?.accentColor  || '#d97706'

  return (
    <section id="contact" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] mb-4" style={{ color: accent }}>
            Reach Out
          </p>
          <h2 className="text-4xl font-bold text-slate-900">Contact Us</h2>
          <p className="mt-3 text-slate-500">
            Our team is here to help you plan the perfect coastal getaway
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">

          {/* Left: map placeholder + contact info */}
          <div className="space-y-8">
            {/* Map placeholder */}
            <div
              className="h-56 rounded-2xl flex items-center justify-center text-4xl text-white font-bold shadow-sm"
              style={{ background: `linear-gradient(135deg, ${primary}, #0e7490)` }}>
              <div className="text-center">
                <div className="text-5xl mb-2">🗺️</div>
                <p className="text-sm font-normal text-white/70">
                  {tenant.address || 'Beachfront Location'}
                </p>
              </div>
            </div>

            {/* Contact details */}
            <div className="space-y-4">
              {tenant.phone && (
                <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ backgroundColor: `${primary}08` }}>
                  <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: primary }}>
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Phone</p>
                    <p className="font-semibold text-slate-800">{tenant.phone}</p>
                  </div>
                </div>
              )}
              {tenant.email && (
                <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ backgroundColor: `${primary}08` }}>
                  <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: primary }}>
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Email</p>
                    <p className="font-semibold text-slate-800">{tenant.email}</p>
                  </div>
                </div>
              )}
              {tenant.address && (
                <div className="flex items-start gap-4 p-4 rounded-2xl" style={{ backgroundColor: `${primary}08` }}>
                  <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: primary }}>
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Address</p>
                    <p className="font-semibold text-slate-800 leading-relaxed">{tenant.address}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: contact form */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Send us a message</h3>
            <ContactForm
              slug={tenant.slug}
              primaryColor={primary}
              accentColor={accent}
              currency={tenant.currency}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
