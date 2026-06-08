'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle2, ExternalLink, Sparkles, Loader2,
  X, Eye, Zap, Crown, Shield, Search,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Theme {
  key:          string;
  name:         string;
  description:  string;
  previewImage?: string;
  isPremium:    boolean;
  requiredPlan: string;
  tags:         string[];
  isDefault:    boolean;
}

interface ThemePickerProps {
  currentTheme: string;
  slug:         string;
  onSelect:     (key: string) => void;
}

/* ── Plan hierarchy ────────────────────────────────────────────────────────── */
const PLAN_RANK: Record<string, number> = { FREE: 0, STARTER: 1, PROFESSIONAL: 2, ENTERPRISE: 3 };
const PLAN_ICON: Record<string, React.ReactNode> = {
  STARTER:      <Zap className="h-3 w-3" />,
  PROFESSIONAL: <Crown className="h-3 w-3" />,
  ENTERPRISE:   <Shield className="h-3 w-3" />,
};
const PLAN_LABEL: Record<string, string> = {
  STARTER: 'Starter+', PROFESSIONAL: 'Pro+', ENTERPRISE: 'Enterprise',
};

function canUsePlan(userPlan: string, required: string): boolean {
  return (PLAN_RANK[userPlan] ?? 0) >= (PLAN_RANK[required] ?? 0);
}

/* ── Fallback static list ──────────────────────────────────────────────────── */
const FALLBACK: Theme[] = [
  { key: 'luxe',    name: 'Luxe Gold',      description: 'Elegant luxury design with gold accents', isPremium: false, requiredPlan: 'STARTER', tags: ['Luxury', 'Gold Accents', 'Full-Screen Hero'], isDefault: true },
  { key: 'minimal', name: 'Minimal Clean',  description: 'Clean modern design with focus on content', isPremium: false, requiredPlan: 'STARTER', tags: ['Clean', 'Modern', 'Content-First'], isDefault: false },
  { key: 'coastal', name: 'Coastal Breeze', description: 'Ocean-inspired design for beach properties', isPremium: false, requiredPlan: 'STARTER', tags: ['Beach', 'Ocean', 'Wave Animations'], isDefault: false },
];

/* ═══════════════════════════════════════════════════════════════════════════ */
export function ThemePicker({ currentTheme, slug, onSelect }: ThemePickerProps) {
  const { tenant } = useAuthStore();
  const userPlan   = tenant?.plan ?? 'STARTER';

  const [themes,   setThemes]   = useState<Theme[]>(FALLBACK);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState<'all' | 'free' | 'premium'>('all');
  const [preview,  setPreview]  = useState<Theme | null>(null);

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
    const matchSearch = !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
    const matchFilter =
      filter === 'all'     ? true :
      filter === 'free'    ? !t.isPremium :
      filter === 'premium' ? t.isPremium : true;
    return matchSearch && matchFilter;
  });

  /* ── Unlock check ────────────────────────────────────────────────────────── */
  const isLocked = (theme: Theme) => !canUsePlan(userPlan, theme.requiredPlan);

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

      {/* Theme grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map(theme => {
          const isSelected = currentTheme === theme.key;
          const locked     = isLocked(theme);

          return (
            <div key={theme.key}
              onClick={() => !locked && onSelect(theme.key)}
              className={`group relative rounded-2xl border-2 overflow-hidden transition-all duration-200 ${
                locked
                  ? 'opacity-70 cursor-not-allowed border-gray-200 dark:border-gray-800'
                  : isSelected
                  ? 'border-resort-600 shadow-lg shadow-resort-100/50 cursor-pointer'
                  : 'border-gray-200 dark:border-gray-700 hover:border-resort-300 hover:shadow-md cursor-pointer'
              }`}>

              {/* Preview image */}
              <div className="relative h-44 overflow-hidden bg-gray-100 dark:bg-gray-800">
                {theme.previewImage
                  ? <img src={theme.previewImage} alt={theme.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  : <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No preview</div>
                }

                {/* Hover overlay with Preview button */}
                {!locked && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center">
                    <button
                      onClick={e => { e.stopPropagation(); setPreview(theme); }}
                      className="flex items-center gap-2 bg-white/90 dark:bg-gray-900/90 text-gray-900 dark:text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg
                                 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0 hover:bg-white dark:hover:bg-gray-800">
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </button>
                  </div>
                )}

                {/* Lock overlay */}
                {locked && (
                  <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center gap-2">
                    <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-black/60 text-white`}>
                      {PLAN_ICON[theme.requiredPlan]}
                      Requires {PLAN_LABEL[theme.requiredPlan]}
                    </div>
                  </div>
                )}

                {/* Active badge */}
                {isSelected && !locked && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-resort-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Active
                  </div>
                )}

                {/* Premium badge */}
                {theme.isPremium && (
                  <div className="absolute top-3 left-3 flex items-center gap-1 bg-amber-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
                    <Sparkles className="h-3 w-3" /> Premium
                  </div>
                )}
              </div>

              {/* Card body */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-1">
                  <h4 className="font-bold text-gray-900 dark:text-white text-sm">{theme.name}</h4>
                  {!theme.isPremium
                    ? <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 px-2 py-0.5 rounded-full">Free</span>
                    : <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Premium
                      </span>
                  }
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">{theme.description}</p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(theme.tags ?? []).map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Actions row */}
                <div className="flex gap-2">
                  {/* Preview button */}
                  <button
                    onClick={e => { e.stopPropagation(); setPreview(theme); }}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-lg py-1.5
                               text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-resort-600 transition-colors">
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </button>

                  {/* Select / Locked */}
                  {locked ? (
                    <div className={`flex-1 flex items-center justify-center gap-1 text-xs font-semibold rounded-lg py-1.5 ${PLAN_ICON[theme.requiredPlan] ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                      {PLAN_ICON[theme.requiredPlan]} {PLAN_LABEL[theme.requiredPlan]}
                    </div>
                  ) : isSelected ? (
                    <div className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg py-1.5 bg-resort-600 text-white">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Selected
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); onSelect(theme.key); }}
                      className="flex-1 text-xs font-semibold rounded-lg py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900
                                 hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors">
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
          isSelected={currentTheme === preview.key}
          locked={isLocked(preview)}
          userPlan={userPlan}
        />
      )}
    </div>
  );
}

/* ── Preview Modal Component ───────────────────────────────────────────────── */
function ThemePreviewModal({
  theme, slug, onClose, onSelect, isSelected, locked, userPlan,
}: {
  theme: Theme; slug: string; onClose: () => void;
  onSelect: () => void; isSelected: boolean; locked: boolean; userPlan: string;
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

            {/* Select / Locked */}
            {locked ? (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 px-4 py-2 rounded-lg">
                {PLAN_ICON[theme.requiredPlan]} Requires {PLAN_LABEL[theme.requiredPlan]}
              </div>
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

        {/* Upgrade prompt for locked themes */}
        {locked && (
          <div className="flex items-center justify-between px-5 py-3 bg-amber-950/80 border-t border-amber-800 flex-shrink-0">
            <p className="text-sm text-amber-300">
              Upgrade to <strong>{PLAN_LABEL[theme.requiredPlan]}</strong> to use this theme.
            </p>
            <a href="/dashboard/billing"
              className="text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded-lg transition-colors">
              Upgrade Plan →
            </a>
          </div>
        )}
      </div>
    </>
  );
}
