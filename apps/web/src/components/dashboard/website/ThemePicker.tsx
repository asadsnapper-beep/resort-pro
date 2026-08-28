'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle2, ExternalLink, Sparkles, Loader2,
  X, Eye, Search, Lock, ShoppingCart,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Theme {
  key:          string;
  name:         string;
  description:  string;
  previewImage?: string;
  isPremium:    boolean;
  tags:         string[];
  /** Usable right now — bought, commissioned, or free. From the API. */
  owned?:       boolean;
  isFree?:      boolean;
  /** Price to pay today, offer applied. */
  priceUsd?:    number;
  priceBdt?:    number;
  /** Undiscounted price, shown struck through while an offer runs. */
  listPriceUsd?: number;
  onOffer?:     boolean;
}

interface ThemePickerProps {
  currentTheme: string;
  slug:         string;
  onSelect:     (key: string) => void;
}

/* ── Fallback static list ──────────────────────────────────────────────────── */
// Only used if the themes request fails outright; these three have always been
// free, so treating them as owned keeps the picker usable rather than showing
// a wall of locks during an outage.
const FALLBACK: Theme[] = [
  { key: 'luxe',    name: 'Luxe Gold',      description: 'Elegant luxury design with gold accents',   isPremium: false, tags: ['Luxury', 'Gold Accents'], owned: true, isFree: true },
  { key: 'minimal', name: 'Minimal Clean',  description: 'Clean modern design with focus on content', isPremium: false, tags: ['Clean', 'Modern'],        owned: true, isFree: true },
  { key: 'coastal', name: 'Coastal Breeze', description: 'Ocean-inspired design for beach properties', isPremium: false, tags: ['Beach', 'Ocean'],         owned: true, isFree: true },
];

/** A theme is locked when it costs money and this resort has not bought it. */
function isLockedTheme(t: Theme) {
  return t.owned === false;
}

function priceLabel(t: Theme) {
  const usd = t.priceUsd ?? 0;
  const bdt = t.priceBdt ?? 0;
  return bdt ? `৳${bdt.toLocaleString('en-BD')}` : `$${usd}`;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export function ThemePicker({ currentTheme, slug, onSelect }: ThemePickerProps) {
  const [themes,   setThemes]   = useState<Theme[]>(FALLBACK);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState<'all' | 'free' | 'premium'>('all');
  const [preview,  setPreview]  = useState<Theme | null>(null);
  const [buying,   setBuying]   = useState<string | null>(null);

  /**
   * Send the owner to bKash for a theme they don't own yet. The server decides
   * the amount from the database — nothing about the price travels from here,
   * so a tampered page cannot buy a $30 theme for one taka.
   */
  const buyTheme = async (theme: Theme) => {
    setBuying(theme.key);
    try {
      const res = await api.post('/theme-purchases/checkout/bkash', { themeKey: theme.key });
      const url = res.data?.data?.url;
      if (url) { window.location.href = url; return; }
      toast({ title: 'Could not start payment', description: 'Please try again.', variant: 'destructive' });
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string } } };
      toast({
        title: e.response?.status === 503 ? 'Payments not set up yet' : 'Purchase failed',
        description: e.response?.data?.error ?? 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBuying(null);
    }
  };

  /* ── Fetch active themes from DB ─────────────────────────────────────────── */
  useEffect(() => {
    setLoading(true);
    fetch(`${API}/site/${slug}/themes`)
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setThemes(json.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  /* ── Filter & search ─────────────────────────────────────────────────────── */
  const filtered = themes.filter(t => {
    const q = search.toLowerCase();
    // `?? []` because a theme may legitimately carry no tags — before, this
    // threw as soon as anyone typed in the search box.
    const matchSearch = !search ||
      t.name.toLowerCase().includes(q) ||
      (t.tags ?? []).some(tag => tag.toLowerCase().includes(q));
    // "free" and "premium" now mean what they cost, not which plan they need.
    const paid = !(t.isFree ?? !t.isPremium);
    const matchFilter =
      filter === 'all'     ? true :
      filter === 'free'    ? !paid :
      filter === 'premium' ? paid : true;
    return matchSearch && matchFilter;
  });

  /* ── Unlock check ────────────────────────────────────────────────────────── */
  const isLocked = (theme: Theme) => isLockedTheme(theme);

  /* ────────────────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Choose Your Website Theme</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your entire public website will update immediately after saving.
          </p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
      </div>

      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search themes…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-input bg-transparent placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {/* Filter pills */}
        <div className="flex gap-1.5">
          {(['all', 'free', 'premium'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                filter === f
                  ? 'bg-resort-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}>
              {f === 'premium' && <Sparkles className="h-3 w-3 inline mr-1" />}{f}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {(search || filter !== 'all') && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} theme{filtered.length !== 1 ? 's' : ''} found
          {search && <> for "<strong>{search}</strong>"</>}
        </p>
      )}

      {/* Theme list — one row per theme.
          Not a multi-column grid: this panel lives inside the website editor's
          fixed 440px column (`lg:grid-cols-[440px_1fr]`), so it has ~407px to
          work with no matter how wide the window gets. The old
          `lg:grid-cols-3` keyed off the *viewport*, which the panel does not
          follow, and squeezed three cards into 122px each — names wrapped and
          the Select and Buy buttons overflowed the card by up to 37px.
          A horizontal row fits the real width and cannot collapse that way. */}
      <div className="flex flex-col gap-3">
        {filtered.map(theme => {
          const isSelected = currentTheme === theme.key;
          const locked     = isLocked(theme);

          return (
            <div key={theme.key}
              onClick={() => !locked && onSelect(theme.key)}
              // Surface from the theme tokens rather than a literal, so the row
              // follows the panel. It could not before: the panel hardcoded its
              // background as an inline style, which no `dark:` class can beat,
              // so it stayed cream in dark mode and any `dark:text-white` here
              // was white-on-cream. That is fixed at the source now — the panel
              // uses --rp-surface-3, which flips.
              className={`group relative flex gap-3 rounded-2xl border-2 bg-[var(--rp-surface)] p-3 transition-all duration-200 ${
                locked
                  ? 'opacity-70 cursor-not-allowed border-[var(--rp-border)]'
                  : isSelected
                  ? 'border-resort-600 shadow-lg shadow-resort-100/50 cursor-pointer'
                  : 'border-[var(--rp-border-md)] hover:border-resort-300 hover:shadow-md cursor-pointer'
              }`}>

              {/* Thumbnail — fixed width so the text column gets the rest */}
              <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-[var(--rp-surface-3)]">
                {theme.previewImage
                  ? <img src={theme.previewImage} alt={theme.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  : (
                    <div className="absolute inset-0 overflow-hidden">
                      <iframe
                        src={`/${slug}?preview=${theme.key}`}
                        title={`${theme.name} preview`}
                        loading="lazy"
                        tabIndex={-1}
                        aria-hidden="true"
                        className="pointer-events-none select-none border-0"
                        style={{
                          width: '500%',
                          height: '500%',
                          transform: 'scale(0.2)',
                          transformOrigin: 'top left',
                        }}
                      />
                    </div>
                  )
                }

                {/* Premium marker. The row has a real Preview button now, so the
                    thumbnail no longer hides one behind a hover state. */}
                {theme.isPremium && (
                  <div className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                    <Sparkles className="h-2.5 w-2.5" /> Premium
                  </div>
                )}
                {locked && (
                  <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                    <Lock className="h-2.5 w-2.5" />
                  </div>
                )}
              </div>

              {/* Text column. min-w-0 is what actually lets this shrink — without
                  it a flex child refuses to go below its content width, which is
                  how the buttons escaped the card before. */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="truncate text-sm font-bold text-[var(--rp-text)]">{theme.name}</h4>
                  {isSelected && !locked ? (
                    <span className="shrink-0 flex items-center gap-1 rounded-full bg-resort-600 px-2 py-0.5 text-xs font-semibold text-white">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </span>
                  ) : theme.isFree ?? !theme.isPremium ? (
                    <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">Free</span>
                  ) : locked ? (
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                      {theme.onOffer && theme.listPriceUsd
                        ? <><span className="text-amber-400 line-through">${theme.listPriceUsd}</span> {priceLabel(theme)}</>
                        : priceLabel(theme)}
                    </span>
                  ) : (
                    <span className="shrink-0 flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">
                      <CheckCircle2 className="h-3 w-3" /> Owned
                    </span>
                  )}
                </div>

                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[var(--rp-text-muted)]">{theme.description}</p>

                {/* Actions pinned to the bottom of the row */}
                <div className="mt-auto flex justify-end gap-2 pt-2">
                  <button
                    onClick={e => { e.stopPropagation(); setPreview(theme); }}
                    className="flex min-w-0 max-w-[180px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--rp-border-md)] py-1.5 text-xs font-medium
                               text-[var(--rp-text-muted)] transition-colors hover:bg-[var(--rp-surface-2)] hover:text-[var(--rp-text)]">
                    <Eye className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Preview</span>
                  </button>

                  {locked ? (
                    <button
                      onClick={e => { e.stopPropagation(); buyTheme(theme); }}
                      disabled={buying === theme.key}
                      // Near-black on amber, not white. White on amber-500 is
                      // 2.1:1 — it looks fine at a glance and fails AA badly,
                      // which is a poor property for the one button that takes
                      // someone's money.
                      className="flex min-w-0 max-w-[180px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 py-1.5 text-xs font-semibold text-gray-900
                                 transition-colors hover:bg-amber-400 disabled:opacity-60">
                      {buying === theme.key
                        ? <><Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> <span className="truncate">Starting…</span></>
                        : <><ShoppingCart className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Buy {priceLabel(theme)}</span></>}
                    </button>
                  ) : isSelected ? (
                    <div className="flex min-w-0 flex-1 max-w-[180px] items-center justify-center gap-1.5 rounded-lg bg-resort-600 py-1.5 text-xs font-semibold text-white">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Selected</span>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); onSelect(theme.key); }}
                      className="min-w-0 max-w-[180px] flex-1 truncate rounded-lg bg-[var(--rp-btn-accent)] py-1.5 text-xs font-semibold text-[var(--rp-btn-accent-text)]
                                 transition-colors hover:opacity-90">
                      Select
                    </button>
                  )}
                </div>
              </div>

              {/* Selection ring */}
              {isSelected && <div className="absolute inset-0 pointer-events-none rounded-2xl ring-2 ring-resort-600 ring-inset" />}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
          <p className="text-sm text-muted-foreground">No themes match your search.</p>
          <button onClick={() => { setSearch(''); setFilter('all'); }}
            className="mt-2 text-xs text-resort-600 hover:underline">Clear filters</button>
        </div>
      )}

      {/* Hint */}
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
        Click a theme to select it, then hit <strong>Save &amp; Publish</strong> to apply.
      </p>

      {/* ── Preview Modal ───────────────────────────────────────────────────── */}
      {preview && (
        <ThemePreviewModal theme={preview} slug={slug} onClose={() => setPreview(null)}
          onSelect={() => { if (!isLocked(preview)) { onSelect(preview.key); setPreview(null); } }}
          onBuy={() => buyTheme(preview)}
          buying={buying === preview.key}
          isSelected={currentTheme === preview.key}
          locked={isLocked(preview)}
        />
      )}
    </div>
  );
}

/* ── Preview Modal Component ───────────────────────────────────────────────── */
function ThemePreviewModal({
  theme, slug, onClose, onSelect, onBuy, buying, isSelected, locked,
}: {
  theme: Theme; slug: string; onClose: () => void;
  onSelect: () => void; onBuy: () => void; buying: boolean;
  isSelected: boolean; locked: boolean;
}) {
  const [iframeLoading, setIframeLoading] = useState(true);
  const previewUrl = `/${slug}?preview=${theme.key}`;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Top bar */}
        <div className="flex items-center gap-4 px-5 py-3 bg-gray-950 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white">{theme.name}</span>
            {theme.isPremium && (
              <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Premium
              </span>
            )}
            <div className="flex gap-1.5">
              {(theme.tags ?? []).map(tag => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{tag}</span>
              ))}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Open in new tab */}
            <a href={previewUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
              <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
            </a>

            {/* Buy / Select / Active */}
            {locked ? (
              <button onClick={onBuy} disabled={buying}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-60 px-4 py-2 rounded-lg transition-colors">
                {buying
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting…</>
                  : <><ShoppingCart className="h-3.5 w-3.5" /> Buy {priceLabel(theme)}</>}
              </button>
            ) : isSelected ? (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white bg-resort-600 px-4 py-2 rounded-lg">
                <CheckCircle2 className="h-3.5 w-3.5" /> Currently Active
              </div>
            ) : (
              <button onClick={onSelect}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-resort-600 hover:bg-resort-700 px-4 py-2 rounded-lg transition-colors">
                <CheckCircle2 className="h-3.5 w-3.5" /> Apply This Theme
              </button>
            )}

            {/* Close */}
            <button onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* iframe */}
        <div className="relative flex-1 bg-gray-900">
          {iframeLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-resort-500" />
                <p className="text-sm text-gray-400">Loading preview…</p>
              </div>
            </div>
          )}
          <iframe
            src={previewUrl}
            className="w-full h-full border-0"
            onLoad={() => setIframeLoading(false)}
            title={`Preview — ${theme.name}`}
          />
        </div>

        {/* Purchase prompt for themes this resort does not own yet */}
        {locked && (
          <div className="flex items-center justify-between px-5 py-3 bg-amber-950/80 border-t border-amber-800 flex-shrink-0">
            <p className="text-sm text-amber-300">
              Buy <strong>{theme.name}</strong> once for <strong>{priceLabel(theme)}</strong> and it stays yours — no renewal.
            </p>
            <button onClick={onBuy} disabled={buying}
              className="text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-60 px-4 py-2 rounded-lg transition-colors">
              {buying ? 'Starting…' : 'Buy with bKash →'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
