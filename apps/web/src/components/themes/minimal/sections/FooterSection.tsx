'use client'
import type { ResortData } from '../../types'

interface FooterSectionProps {
  data:     ResortData
  scrollTo: (id: string) => void
}

const NAV_ITEMS = [
  { id: 'about',        label: 'About' },
  { id: 'rooms',        label: 'Rooms' },
  { id: 'availability', label: 'Availability' },
  { id: 'booking',      label: 'Book' },
  { id: 'contact',      label: 'Contact' },
]

export function FooterSection({ data, scrollTo }: FooterSectionProps) {
  const { tenant } = data

  return (
    <footer className="border-t border-slate-200 bg-white py-8">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm font-semibold text-slate-900">{tenant.name}</p>

        <nav className="flex items-center gap-6">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className="text-xs text-slate-400 hover:text-slate-700 transition-colors">
              {item.label}
            </button>
          ))}
        </nav>

        <p className="text-xs text-slate-300">
          © {new Date().getFullYear()} {tenant.name}
        </p>
      </div>
    </footer>
  )
}
