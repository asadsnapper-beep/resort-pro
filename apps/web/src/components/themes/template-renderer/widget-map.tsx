import type { ReactElement } from 'react'
import type { ResortData } from '../types'
import { AvailabilityCalendar, BookingForm, MenuWidget, ContactForm, VenuesWidget, VehiclesWidget } from '../_widgets'
import { OffersSection } from '../_widgets/OffersWidget'
import { SocialLinks } from '../_widgets/SocialLinks'

/** The 8 interactive mount points a Tier 2 template can use — see plan/theme-contract.md §4. */
export const KNOWN_MOUNT_POINTS = [
  'booking', 'availability', 'menu', 'venues', 'vehicles', 'contact', 'offers', 'social-links',
] as const

export type MountPoint = typeof KNOWN_MOUNT_POINTS[number]

export function isKnownMountPoint(value: string): value is MountPoint {
  return (KNOWN_MOUNT_POINTS as readonly string[]).includes(value)
}

/**
 * Resolves the exact props each widget needs from the full ResortData
 * payload. Each widget has its own prop shape (BookingForm needs `rooms`,
 * SocialLinks needs `website` instead of slug/colors, etc.) — this is the
 * one place that knows how to bridge "generic data-rp-widget mount point"
 * to "concrete already-built React component call".
 */
export function renderMountPoint(mount: MountPoint, data: ResortData): ReactElement | null {
  const { tenant, website, rooms } = data
  const primaryColor = website?.primaryColor || '#1a6b5e'
  const accentColor = website?.accentColor || '#d4a853'
  const base = { slug: tenant.slug, primaryColor, accentColor, currency: tenant.currency }

  switch (mount) {
    case 'booking':
      return (
        <BookingForm
          {...base}
          rooms={rooms}
          checkInTime={tenant.checkInTime}
          checkOutTime={tenant.checkOutTime}
        />
      )
    case 'availability':
      return <AvailabilityCalendar {...base} />
    case 'menu':
      return <MenuWidget {...base} />
    case 'venues':
      return <VenuesWidget {...base} />
    case 'vehicles':
      return <VehiclesWidget {...base} />
    case 'contact':
      return <ContactForm {...base} />
    case 'offers':
      return <OffersSection slug={tenant.slug} primaryColor={primaryColor} accentColor={accentColor} />
    case 'social-links':
      return <SocialLinks website={website} />
    default:
      return null
  }
}
