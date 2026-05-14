import { Wifi, Car, Coffee, Waves, Dumbbell, Utensils, Shield, Wind, CheckCircle } from 'lucide-react'

/* ── Currency formatter ──────────────────────────────────────────────────────── */
export function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(amount)
}

/* ── Amenity icon map ────────────────────────────────────────────────────────── */
export const AMENITY_ICONS: Record<string, React.ElementType> = {
  wifi: Wifi, parking: Car, breakfast: Coffee, pool: Waves,
  gym: Dumbbell, restaurant: Utensils, security: Shield, ac: Wind,
}

export function AmenityIcon({ amenity }: { amenity: string }) {
  const lower = amenity.toLowerCase()
  const Icon  = Object.entries(AMENITY_ICONS).find(([k]) => lower.includes(k))?.[1] ?? CheckCircle
  return <Icon className="h-3.5 w-3.5" />
}
