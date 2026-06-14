'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  MapPin, List, Search, Filter, X,
  ChevronRight, Globe, Loader2, ChevronUp,
  Leaf, Wheat, Waves, Mountain, Building2, Landmark, Hotel,
  Star, ExternalLink,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import DiscoverySchema from '@/components/stay/DiscoverySchema';

// Leaflet map — loaded client-side only (no SSR)
const ResortMap = dynamic(() => import('@/components/stay/ResortMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#f0faf8]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-[#1a6b5e] animate-spin" />
        <p className="text-sm text-gray-400">Loading map…</p>
      </div>
    </div>
  ),
});

// ─── Types ──────────────────────────────────────────────────────────────────

interface Resort {
  slug:                string;
  name:                string;
  country:             string;
  category:            string;
  shortDescription:    string;
  coverImageUrl:       string | null;
  priceFrom:           number | null;
  latitude:            number | null;
  longitude:           number | null;
  website:             string | null;
  url:                 string;
  // Revenue fields
  isFeatured:          boolean;
  featuredBadge:       string | null;
  affiliateUrl:        string | null;
  affiliateSource:     string | null;
  tier:                string;
  galleryImages:       string[];
  amenitiesHighlights: string[];
  bookingPhone:        string | null;
  instagramHandle:     string | null;
}

interface Country { code: string; name: string; count: number; }

// ─── Category config ─────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'eco',      label: 'Eco',      emoji: '🌿', Icon: Leaf,      color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'agro',     label: 'Agro',     emoji: '🌾', Icon: Wheat,     color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'beach',    label: 'Beach',    emoji: '🏖️', Icon: Waves,     color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'hill',     label: 'Hill',     emoji: '⛰️', Icon: Mountain,  color: 'bg-stone-50 text-stone-700 border-stone-200' },
  { value: 'city',     label: 'City',     emoji: '🏙️', Icon: Building2, color: 'bg-slate-50 text-slate-700 border-slate-200' },
  { value: 'heritage', label: 'Heritage', emoji: '🏛️', Icon: Landmark,  color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'resort',   label: 'Resort',   emoji: '🏨', Icon: Hotel,     color: 'bg-purple-50 text-purple-700 border-purple-200' },
];

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ─── Click tracker (fire-and-forget) ────────────────────────────────────────

async function trackClick(slug: string, type: string, source?: string): Promise<string | null> {
  try {
    const res  = await fetch(`${API}/api/discovery/click`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ slug, type, source }),
    });
    const json = await res.json();
    return json.redirect ?? null;
  } catch {
    return null;
  }
}

// ─── Skeleton Card ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-36 bg-gray-100" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-gray-100 rounded-full w-3/4" />
        <div className="h-3 bg-gray-100 rounded-full w-full" />
        <div className="h-3 bg-gray-100 rounded-full w-2/3" />
        <div className="flex justify-between mt-1">
          <div className="h-3 bg-gray-100 rounded-full w-10" />
          <div className="h-3 bg-gray-100 rounded-full w-20" />
        </div>
      </div>
    </div>
  );
}

function SkeletonList({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </>
  );
}

// ─── Resort Card ─────────────────────────────────────────────────────────────

function ResortCard({
  resort, onClick, compact = false,
}: {
  resort:   Resort;
  onClick:  () => void;
  compact?: boolean;
}) {
  const cat = CATEGORIES.find(c => c.value === resort.category);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-2xl border shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 overflow-hidden group ${
        resort.isFeatured
          ? 'border-[#d4a853]/40 ring-1 ring-[#d4a853]/20'
          : 'border-gray-100 hover:border-[#b2ddd6]'
      }`}>

      {/* Cover image */}
      {!compact && (
        <div className="h-36 bg-gradient-to-br from-[#1a6b5e] to-[#145a4f] relative overflow-hidden">
          {resort.coverImageUrl ? (
            <img
              src={resort.coverImageUrl}
              alt={resort.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MapPin className="w-10 h-10 text-white/20" />
            </div>
          )}

          {/* Category chip */}
          {cat && (
            <span className={`absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full border backdrop-blur-sm bg-white/90 ${cat.color}`}>
              {cat.emoji} {cat.label}
            </span>
          )}

          {/* Featured badge */}
          {resort.isFeatured && resort.featuredBadge && (
            <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#d4a853] text-white shadow-sm">
              <Star className="w-2.5 h-2.5 fill-white" />
              {resort.featuredBadge}
            </span>
          )}
        </div>
      )}

      {/* Info */}
      <div className={compact ? 'p-2.5 flex items-center gap-2.5' : 'p-3'}>
        {compact && resort.coverImageUrl && (
          <img src={resort.coverImageUrl} alt={resort.name}
            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
        )}
        {compact && !resort.coverImageUrl && (
          <div className="w-10 h-10 rounded-lg bg-[#f0faf8] flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4 h-4 text-[#1a6b5e]" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <div className="flex items-center gap-1 min-w-0">
              <h3 className={`font-semibold text-gray-800 leading-tight line-clamp-1 ${compact ? 'text-xs' : 'text-sm'}`}>
                {resort.name}
              </h3>
              {/* Compact featured badge */}
              {compact && resort.isFeatured && resort.featuredBadge && (
                <span className="flex-shrink-0 flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#d4a853]/15 text-[#b8882e]">
                  <Star className="w-2 h-2 fill-[#b8882e]" />
                  {resort.featuredBadge}
                </span>
              )}
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5 group-hover:text-[#1a6b5e] transition-colors" />
          </div>

          {!compact && resort.shortDescription && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{resort.shortDescription}</p>
          )}

          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-400 flex items-center gap-0.5">
              <Globe className="w-3 h-3" /> {resort.country}
            </span>
            {resort.priceFrom && (
              <span className={`font-semibold text-[#1a6b5e] ${compact ? 'text-[10px]' : 'text-xs'}`}>
                ৳{resort.priceFrom.toLocaleString()}/night
              </span>
            )}
          </div>

          {/* Affiliate source label for premium cards */}
          {!compact && resort.affiliateUrl && resort.affiliateSource && (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-400">
              <ExternalLink className="w-2.5 h-2.5" />
              Book via {resort.affiliateSource}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Mobile Bottom Sheet ─────────────────────────────────────────────────────

function MobileBottomSheet({
  resorts, loading, onSelect, onOpen,
}: {
  resorts:  Resort[];
  loading:  boolean;
  onSelect: (r: Resort) => void;
  onOpen:   (r: Resort) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl border-t border-gray-100 transition-all duration-300 z-[500] ${
        expanded ? 'h-[70vh]' : 'h-[200px]'
      }`}>

      {/* Drag handle */}
      <div
        ref={dragRef}
        onClick={() => setExpanded(e => !e)}
        className="flex flex-col items-center pt-2.5 pb-2 cursor-pointer select-none">
        <div className="w-10 h-1 bg-gray-200 rounded-full mb-2" />
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
          {expanded ? (
            <><ChevronUp className="w-3.5 h-3.5" /> Close list</>
          ) : (
            <><ChevronUp className="w-3.5 h-3.5 rotate-180" />
              {loading ? 'Loading…' : `${resorts.length} resort${resorts.length !== 1 ? 's' : ''} nearby`}
            </>
          )}
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto px-3 pb-safe" style={{ height: 'calc(100% - 52px)' }}>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-2.5 flex items-center gap-2.5 animate-pulse">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-100 rounded-full w-2/3" />
                  <div className="h-2.5 bg-gray-100 rounded-full w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : resorts.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#f0faf8] flex items-center justify-center mb-3">
              <MapPin className="w-7 h-7 text-[#1a6b5e]/40" />
            </div>
            <p className="text-sm font-medium text-gray-600">No resorts found</p>
            <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="space-y-2">
            {resorts.map(r => (
              <ResortCard
                key={r.slug}
                resort={r}
                compact
                onClick={() => { onSelect(r); setExpanded(false); }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#f0faf8] to-[#ddf0ec] flex items-center justify-center mb-5 shadow-inner">
        <MapPin className="w-10 h-10 text-[#1a6b5e]/40" />
      </div>
      <h3 className="text-lg font-bold text-gray-700 mb-1">
        {hasFilters ? 'No resorts match your filters' : 'No resorts yet'}
      </h3>
      <p className="text-sm text-gray-400 max-w-xs mb-5">
        {hasFilters
          ? 'Try removing some filters to see more resorts.'
          : 'Be the first to list your resort on stay.resortpro.site!'}
      </p>
      {hasFilters ? (
        <button
          onClick={onClear}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a6b5e] text-white text-sm font-semibold hover:bg-[#145a4f] transition-colors">
          <X className="w-4 h-4" /> Clear Filters
        </button>
      ) : (
        <a
          href="https://resortpro.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a6b5e] text-white text-sm font-semibold hover:bg-[#145a4f] transition-colors">
          List Your Resort →
        </a>
      )}
    </div>
  );
}

// ─── Main Discovery Inner ─────────────────────────────────────────────────────

function DiscoverInner() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [view,      setView]      = useState<'map' | 'list'>(searchParams.get('view') === 'list' ? 'list' : 'map');
  const [resorts,   setResorts]   = useState<Resort[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [total,     setTotal]     = useState(0);

  // Filters
  const [q,          setQ]          = useState(searchParams.get('q') ?? '');
  const [country,    setCountry]    = useState(searchParams.get('country') ?? '');
  const [category,   setCategory]   = useState(searchParams.get('category') ?? '');
  const [showFilter, setShowFilter] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Map selected
  const [selected, setSelected] = useState<Resort | null>(null);

  // ── Fetch ───────────────────────────────────────────────────────────────
  const fetchResorts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q)        params.set('q',        q);
      if (country)  params.set('country',  country);
      if (category) params.set('category', category);
      params.set('limit', '100');

      const res  = await fetch(`${API}/api/discovery/resorts?${params}`);
      const json = await res.json();
      if (json.success) {
        setResorts(json.data.resorts);
        setTotal(json.data.pagination.total);
      }
    } finally {
      setLoading(false);
    }
  }, [q, country, category]);

  useEffect(() => {
    fetch(`${API}/api/discovery/countries`)
      .then(r => r.json())
      .then(j => { if (j.success) setCountries(j.data); });
  }, []);

  useEffect(() => { fetchResorts(); }, [fetchResorts]);

  const clearFilters = () => { setQ(''); setCountry(''); setCategory(''); };
  const hasFilters   = !!(q || country || category);

  // ── Navigate to a resort: track click + open ────────────────────────────
  const goToResort = useCallback(async (resort: Resort, source: string = 'list_card') => {
    // 1. Track the click
    const redirectUrl = await trackClick(resort.slug, source, resort.affiliateSource ?? undefined);

    // 2. For affiliate clicks → open affiliate URL (returned by API)
    if (source === 'affiliate' && redirectUrl) {
      window.open(redirectUrl, '_blank', 'noopener');
      return;
    }

    // 3. If resort has an affiliate URL → track as affiliate click and redirect
    if (resort.affiliateUrl) {
      await trackClick(resort.slug, 'affiliate', resort.affiliateSource ?? undefined);
      window.open(resort.affiliateUrl, '_blank', 'noopener');
      return;
    }

    // 4. Direct website
    if (resort.website) {
      window.open(resort.website, '_blank', 'noopener');
      return;
    }

    // 5. Profile page
    router.push(`/resort/${resort.slug}`);
  }, [router]);

  const mapPins = resorts.filter(r => r.latitude && r.longitude) as (Resort & { latitude: number; longitude: number })[];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 56px)' }}>

      {/* Schema.org for SEO — injected client-side after data loads */}
      {!loading && <DiscoverySchema resorts={resorts} />}

      {/* ── Hero / Search bar ───────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#1a6b5e] via-[#1a6b5e] to-[#145a4f] text-white px-4 py-4">
        <div className="max-w-7xl mx-auto">
          {/* Title — hidden on mobile to save space */}
          <div className="hidden sm:block mb-3">
            <h1 className="text-lg font-bold">Discover Resorts in South Asia</h1>
            <p className="text-xs text-white/60">Eco · Agro · Beach · Hill · Heritage</p>
          </div>

          {/* Search row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search resorts, location…"
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchInputRef.current?.blur()}
                className="w-full bg-white/15 backdrop-blur border border-white/20 rounded-xl pl-9 pr-8 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:border-white/50 focus:bg-white/20 transition-all"
              />
              {q && (
                <button onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-white/20">
                  <X className="w-3.5 h-3.5 text-white/60" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilter(f => !f)}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                showFilter || hasFilters
                  ? 'bg-white text-[#1a6b5e] border-white shadow-sm'
                  : 'border-white/30 text-white hover:border-white/60'
              }`}>
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filter</span>
              {hasFilters && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#d4a853] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {[q, country, category].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          {/* Category chips — always visible */}
          <div className="flex gap-1.5 mt-2.5 overflow-x-auto pb-0.5 scrollbar-hide">
            <button
              onClick={() => setCategory('')}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                !category
                  ? 'bg-white text-[#1a6b5e] border-white'
                  : 'border-white/30 text-white/80 hover:border-white/60'
              }`}>
              All
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(v => v === cat.value ? '' : cat.value)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  category === cat.value
                    ? 'bg-white text-[#1a6b5e] border-white'
                    : 'border-white/30 text-white/80 hover:border-white/60'
                }`}>
                <span>{cat.emoji}</span>
                <span className="hidden sm:inline">{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Advanced filter panel */}
          {showFilter && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2 p-3 bg-white/10 rounded-xl border border-white/15">
              <select
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="bg-white/15 border border-white/20 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-white/40 min-w-[140px]">
                <option value="">All Countries</option>
                {countries.map(c => (
                  <option key={c.code} value={c.code}>{c.name} ({c.count})</option>
                ))}
              </select>
              {hasFilters && (
                <button onClick={clearFilters} className="text-white/70 text-xs flex items-center gap-1 hover:text-white">
                  <X className="w-3 h-3" /> Clear all
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── View toggle + count strip ────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {loading
              ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</span>
              : <span>{total.toLocaleString()} resort{total !== 1 ? 's' : ''}</span>
            }
          </span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setView('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                view === 'map' ? 'bg-[#1a6b5e] text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}>
              <MapPin className="w-3.5 h-3.5" /> Map
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                view === 'list' ? 'bg-[#1a6b5e] text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}>
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {view === 'map' ? (
        <div className="relative flex-1" style={{ minHeight: 400 }}>
          {/* Desktop: map + sidebar */}
          <div className="hidden lg:flex h-full" style={{ height: 'calc(100vh - 56px - 84px - 40px)' }}>
            {/* Map */}
            <div className="flex-1 relative">
              <ResortMap
                pins={mapPins}
                selected={selected}
                onSelect={(r) => {
                  setSelected(r);
                  trackClick(r.slug, 'map_pin').catch(() => {});
                }}
                onOpen={(r) => goToResort(r, 'map_pin')}
              />
              {!loading && mapPins.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-white/95 backdrop-blur rounded-2xl px-6 py-4 shadow-xl text-center">
                    <MapPin className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-500">No resorts on map yet</p>
                    <p className="text-xs text-gray-400 mt-0.5">Enable map visibility in your dashboard</p>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="w-80 border-l border-gray-100 bg-[#fafafa] flex flex-col overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 bg-white">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {loading ? 'Loading…' : `${resorts.length} Resorts`}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                {loading ? (
                  <SkeletonList count={5} />
                ) : resorts.length === 0 ? (
                  <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
                ) : (
                  resorts.map(r => (
                    <ResortCard
                      key={r.slug}
                      resort={r}
                      onClick={() => {
                        setSelected(r);
                        trackClick(r.slug, 'list_card').catch(() => {});
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Mobile: full-screen map + bottom sheet */}
          <div className="lg:hidden relative" style={{ height: 'calc(100vh - 56px - 84px - 40px)' }}>
            <ResortMap
              pins={mapPins}
              selected={selected}
              onSelect={(r) => {
                setSelected(r);
                trackClick(r.slug, 'map_pin').catch(() => {});
              }}
              onOpen={(r) => goToResort(r, 'map_pin')}
            />
            <MobileBottomSheet
              resorts={resorts}
              loading={loading}
              onSelect={r => { setSelected(r); }}
              onOpen={(r) => goToResort(r, 'list_card')}
            />
          </div>
        </div>
      ) : (
        /* ── List view ──────────────────────────────────────────────────── */
        <div className="max-w-7xl mx-auto px-4 py-6 w-full">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <SkeletonList count={8} />
            </div>
          ) : resorts.length === 0 ? (
            <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
          ) : (
            <>
              {/* Active filter pills */}
              {hasFilters && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {q && (
                    <span className="inline-flex items-center gap-1.5 bg-[#f0faf8] border border-[#b2ddd6] text-[#1a6b5e] text-xs font-medium px-3 py-1 rounded-full">
                      "{q}"
                      <button onClick={() => setQ('')}><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {country && (
                    <span className="inline-flex items-center gap-1.5 bg-[#f0faf8] border border-[#b2ddd6] text-[#1a6b5e] text-xs font-medium px-3 py-1 rounded-full">
                      {countries.find(c => c.code === country)?.name ?? country}
                      <button onClick={() => setCountry('')}><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {category && (
                    <span className="inline-flex items-center gap-1.5 bg-[#f0faf8] border border-[#b2ddd6] text-[#1a6b5e] text-xs font-medium px-3 py-1 rounded-full">
                      {CATEGORIES.find(c => c.value === category)?.emoji} {CATEGORIES.find(c => c.value === category)?.label}
                      <button onClick={() => setCategory('')}><X className="w-3 h-3" /></button>
                    </span>
                  )}
                </div>
              )}

              {/* Featured row (if any) */}
              {resorts.some(r => r.isFeatured) && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-4 h-4 text-[#d4a853] fill-[#d4a853]" />
                    <h2 className="text-sm font-bold text-gray-700">Featured Resorts</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {resorts.filter(r => r.isFeatured).map(r => (
                      <ResortCard key={r.slug} resort={r} onClick={() => goToResort(r, 'list_card')} />
                    ))}
                  </div>
                  <div className="mt-5 mb-3 border-t border-gray-100" />
                  <h2 className="text-sm font-bold text-gray-500 mb-3">All Resorts</h2>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {resorts.filter(r => !r.isFeatured).map(r => (
                  <ResortCard key={r.slug} resort={r} onClick={() => goToResort(r, 'list_card')} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#1a6b5e]" />
          <p className="text-sm text-gray-400">Loading discovery…</p>
        </div>
      </div>
    }>
      <DiscoverInner />
    </Suspense>
  );
}
