'use client'
import { Phone, Mail, MapPin } from 'lucide-react'
import { ContactForm } from '../../_widgets'
import type { ResortData } from '../../types'

interface ContactSectionProps {
  data: ResortData
}

export function ContactSection({ data }: ContactSectionProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '#2563eb'

  return (
    <section id="contact" className="py-20 bg-slate-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-4"
            style={{ color: primary }}>
            Get in Touch
          </p>
          <h2 className="text-4xl font-bold text-slate-900">Contact Us</h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-16">
          {/* Form */}
          <div className="bg-white rounded-sm border border-slate-200 p-8">
            <ContactForm
              slug={tenant.slug}
              primaryColor={primary}
              accentColor={website?.accentColor || '#0f172a'}
              currency={tenant.currency}
            />
          </div>

          {/* Info */}
          <div className="flex flex-col justify-center space-y-8">
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{tenant.name}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                {website?.aboutText
                  ? website.aboutText.substring(0, 200) + ((website.aboutText.length ?? 0) > 200 ? '…' : '')
                  : "We'd love to hear from you. Reach out with any questions about your stay."}
              </p>
            </div>

            <div className="space-y-5">
              {tenant.phone && (
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-sm flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${primary}10` }}>
                    <Phone className="h-4 w-4" style={{ color: primary }} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Phone</p>
                    <p className="text-sm font-medium text-slate-700">{tenant.phone}</p>
                  </div>
                </div>
              )}
              {tenant.email && (
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-sm flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${primary}10` }}>
                    <Mail className="h-4 w-4" style={{ color: primary }} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Email</p>
                    <p className="text-sm font-medium text-slate-700">{tenant.email}</p>
                  </div>
                </div>
              )}
              {tenant.address && (
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-sm flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${primary}10` }}>
                    <MapPin className="h-4 w-4" style={{ color: primary }} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Address</p>
                    <p className="text-sm font-medium text-slate-700 leading-relaxed">{tenant.address}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
