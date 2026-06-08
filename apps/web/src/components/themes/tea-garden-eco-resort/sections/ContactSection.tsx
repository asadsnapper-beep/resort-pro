'use client'
import { Phone, Mail, MapPin } from 'lucide-react'
import { ContactForm } from '../../_widgets'
import type { ResortData } from '../../types'

interface ContactSectionProps {
  data: ResortData
}

export function ContactSection({ data }: ContactSectionProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '#1a6b2a'
  const accent  = website?.accentColor  || '#d3d558'

  return (
    <section id="contact" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-[0.4em] mb-4" style={{ color: accent }}>
            Get in Touch
          </p>
          <h2 className="font-serif text-4xl font-bold" style={{ color: '#0d2e14' }}>Contact Us</h2>
          <p className="mt-3 text-slate-500">Our team is ready to help you plan your garden retreat</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">

          {/* Left: info */}
          <div className="space-y-6">
            {/* Decorative illustration panel */}
            <div
              className="h-48 rounded-3xl flex items-center justify-center shadow-sm"
              style={{ background: `linear-gradient(135deg, ${primary}, #0d3a18)` }}
            >
              <div className="text-center">
                <p className="text-6xl mb-2">🌿</p>
                <p className="text-sm text-white/70 font-medium">
                  {tenant.address || 'Hillside Tea Garden Resort'}
                </p>
              </div>
            </div>

            {/* Contact details */}
            <div className="space-y-3">
              {tenant.phone && (
                <div
                  className="flex items-center gap-4 p-4 rounded-2xl"
                  style={{ backgroundColor: `${primary}08` }}
                >
                  <div
                    className="h-11 w-11 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: primary }}
                  >
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Phone</p>
                    <p className="font-semibold text-slate-800">{tenant.phone}</p>
                  </div>
                </div>
              )}
              {tenant.email && (
                <div
                  className="flex items-center gap-4 p-4 rounded-2xl"
                  style={{ backgroundColor: `${primary}08` }}
                >
                  <div
                    className="h-11 w-11 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: primary }}
                  >
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Email</p>
                    <p className="font-semibold text-slate-800">{tenant.email}</p>
                  </div>
                </div>
              )}
              {tenant.address && (
                <div
                  className="flex items-start gap-4 p-4 rounded-2xl"
                  style={{ backgroundColor: `${primary}08` }}
                >
                  <div
                    className="h-11 w-11 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: primary }}
                  >
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

          {/* Right: form */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <h3 className="font-serif text-xl font-bold mb-6" style={{ color: '#0d2e14' }}>
              Send us a message
            </h3>
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
