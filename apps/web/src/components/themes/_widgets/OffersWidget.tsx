'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tag, ChevronLeft, ChevronRight, MoonStar, Percent, DollarSign, Clock, X } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type OfferType = 'PERCENTAGE' | 'FIXED' | 'FREE_NIGHT';

export interface PublicOffer {
  id: string;
  title: string;
  description?: string;
  type: OfferType;
  value: number;
  promoCode?: string | null;
  validFrom: string;
  validTo: string;
  minStay: number;
  roomIds: string[];
  showOnBar: boolean;
  showSection: boolean;
  showOnCards: boolean;
  priority: number;
}

function formatValue(o: PublicOffer) {
  if (o.type === 'PERCENTAGE') return `${o.value}% Off`;
  if (o.type === 'FIXED')      return `$${o.value} Off`;
  if (o.type === 'FREE_NIGHT') return `${o.value} Free Night${o.value > 1 ? 's' : ''}`;
  return String(o.value);
}

function daysLeft(validTo: string) {
  const diff = Math.ceil((new Date(validTo).getTime() - Date.now()) / 86_400_000);
  if (diff <= 0)  return 'Expires today';
  if (diff === 1) return '1 day left';
  if (diff <= 7)  return `${diff} days left`;
  return null;
}

// ── Hook: fetch public offers ─────────────────────────────────────────────────
export function usePublicOffers(slug: string) {
  const [offers, setOffers] = useState<PublicOffer[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/site/${slug}/offers`)
      .then(r => r.json())
      .then(j => { if (j.success) setOffers(j.data ?? []); })
      .catch(() => {});
  }, [slug]);
  return offers;
}

// ── AnnouncementBar ───────────────────────────────────────────────────────────
export function AnnouncementBar({
  slug, primaryColor, accentColor, onHide,
}: {
  slug: string;
  primaryColor: string;
  accentColor: string;
  onHide?: () => void;
}) {
  const allOffers  = usePublicOffers(slug);
  const barOffers  = allOffers.filter(o => o.showOnBar);
  const [idx, setIdx] = useState(0);

  const next = useCallback(() => setIdx(i => (i + 1) % barOffers.length), [barOffers.length]);
  const prev = useCallback(() => setIdx(i => (i - 1 + barOffers.length) % barOffers.length), [barOffers.length]);

  useEffect(() => {
    if (barOffers.length <= 1) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [barOffers.length, next]);

  if (barOffers.length === 0) return null;

  const offer = barOffers[idx];
  const left  = daysLeft(offer.validTo);

  return (
    <div
      className="relative flex items-center justify-center gap-3 px-10 py-2.5 text-sm font-medium text-white"
      style={{ backgroundColor: accentColor, zIndex: 50 }}
    >
      <Tag className="h-3.5 w-3.5 flex-shrink-0 opacity-80" />
      <span className="text-center">
        <span className="font-bold">{formatValue(offer)}</span>
        {' — '}
        {offer.title}
        {offer.promoCode && (
          <span className="ml-2 inline-flex items-center gap-1 rounded bg-white/20 px-2 py-0.5 font-mono text-xs font-bold tracking-wide">
            {offer.promoCode}
          </span>
        )}
        {left && (
          <span className="ml-2 inline-flex items-center gap-1 opacity-80 text-xs">
            <Clock className="h-3 w-3" />{left}
          </span>
        )}
      </span>

      {barOffers.length > 1 && (
        <div className="flex items-center gap-1">
          <button onClick={prev} className="rounded p-0.5 hover:bg-white/20 transition-colors">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs opacity-60">{idx + 1}/{barOffers.length}</span>
          <button onClick={next} className="rounded p-0.5 hover:bg-white/20 transition-colors">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <button
        onClick={onHide}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-white/20 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── OffersSection ─────────────────────────────────────────────────────────────
const TYPE_ICON: Record<OfferType, React.ElementType> = {
  PERCENTAGE: Percent,
  FIXED:      DollarSign,
  FREE_NIGHT: MoonStar,
};

export function OffersSection({
  slug, primaryColor, accentColor, onApplyCode,
}: {
  slug: string;
  primaryColor: string;
  accentColor: string;
  onApplyCode?: (code: string) => void;
}) {
  const allOffers     = usePublicOffers(slug);
  const sectionOffers = allOffers.filter(o => o.showSection);

  if (sectionOffers.length === 0) return null;

  return (
    <section id="offers" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Heading */}
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] mb-3" style={{ color: accentColor }}>
            Special Deals
          </p>
          <h2 className="text-4xl font-bold text-slate-900">Exclusive Offers</h2>
          <p className="mt-3 text-slate-500 max-w-lg mx-auto">
            Book direct for the best rates and enjoy our exclusive promotions
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sectionOffers.map(offer => {
            const TypeIcon = TYPE_ICON[offer.type];
            const left     = daysLeft(offer.validTo);
            return (
              <div
                key={offer.id}
                className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
              >
                {/* Decorative background blob */}
                <div
                  className="absolute -top-8 -right-8 h-28 w-28 rounded-full opacity-10 transition-transform duration-500 group-hover:scale-150"
                  style={{ backgroundColor: accentColor }}
                />

                {/* Type icon */}
                <div
                  className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <TypeIcon className="h-6 w-6" style={{ color: primaryColor }} />
                </div>

                {/* Value badge */}
                <div
                  className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  {formatValue(offer)}
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-1">{offer.title}</h3>
                {offer.description && (
                  <p className="text-sm text-slate-500 leading-relaxed mb-4">{offer.description}</p>
                )}

                {/* Meta */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400 mb-4">
                  {offer.minStay > 1 && (
                    <span>Min {offer.minStay} nights</span>
                  )}
                  {left && (
                    <span className="flex items-center gap-1 text-amber-500">
                      <Clock className="h-3 w-3" /> {left}
                    </span>
                  )}
                </div>

                {/* Promo code / CTA */}
                {offer.promoCode ? (
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-1 rounded-lg border border-dashed px-3 py-2 text-center font-mono text-sm font-bold tracking-wider"
                      style={{ borderColor: primaryColor, color: primaryColor }}
                    >
                      {offer.promoCode}
                    </div>
                    {onApplyCode && (
                      <button
                        onClick={() => onApplyCode(offer.promoCode!)}
                        className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Apply
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Applied automatically at checkout</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Room offer badge helper ────────────────────────────────────────────────────
export function getBestOfferForRoom(roomId: string, offers: PublicOffer[]): PublicOffer | null {
  const matching = offers.filter(
    o => o.showOnCards && (o.roomIds.length === 0 || o.roomIds.includes(roomId)),
  );
  if (matching.length === 0) return null;
  // Sort by best discount value descending
  return matching.sort((a, b) => {
    const score = (o: PublicOffer) => (o.type === 'PERCENTAGE' ? o.value : 0);
    return score(b) - score(a);
  })[0];
}
