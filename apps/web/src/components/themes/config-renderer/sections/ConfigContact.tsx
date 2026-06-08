'use client'
import { Phone, Mail, MapPin } from 'lucide-react'
import { ContactForm } from '../../_widgets'
import type { ResortData } from '../../types'
import type { ThemeConfig } from '../config-types'

interface Props {
  data:   ResortData
  config: ThemeConfig
}

export function ConfigContact({ data, config }: Props) {
  const { tenant, website } = data
  const { colors, fonts } = config
  const primary     = website?.primaryColor || colors.primary
  const accent      = website?.accentColor  || colors.accent
  const headingFont = fonts.heading === 'serif' ? 'Georgia, Cambria, serif' : 'inherit'

  const infoItems = [
    { icon: Phone,  label: 'Phone',   value: tenant.phone   },
    { icon: Mail,   label: 'Email',   value: tenant.email   },
    { icon: MapPin, label: 'Address', value: tenant.address },
  ].filter(i => i.value)

  return (
    <section id="contact" className="py-24" style={{ backgroundColor: colors.background }}>
      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-[0.4em] mb-4" style={{ color: accent }}>
            Get in Touch
          </p>
          <h2
            className="text-4xl font-bold"
            style={{ fontFamily: headingFont, color: colors.text }}
          >
            Contact Us
          </h2>
          <p className="mt-3 text-sm" style={{ color: colors.textMuted }}>
            Our team is ready to help you plan your perfect stay
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">

          {/* Left: info panel */}
          <div className="space-y-4">
            <div
              className="h-44 rounded-3xl flex items-center justify-center shadow-sm"
              style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }}
            >
              <div className="text-center text-white">
                <p className="text-5xl mb-2">{tenant.name.charAt(0)}</p>
                <p className="text-sm opacity-75 font-medium px-8 text-center">
                  {tenant.address || tenant.name}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {infoItems.map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="flex items-center gap-4 p-4 rounded-2xl"
                  style={{ backgroundColor: `${primary}08` }}
                >
                  <div
                    className="h-11 w-11 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: primary }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: colors.textMuted }}>{label}</p>
                    <p className="font-semibold text-sm" style={{ color: colors.text }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: form */}
          <div
            className="rounded-3xl border shadow-sm p-8"
            style={{ backgroundColor: colors.surface, borderColor: `${primary}15` }}
          >
            <h3
              className="font-bold text-xl mb-6"
              style={{ fontFamily: headingFont, color: colors.text }}
            >
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
