'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminEndpoints } from '@/lib/admin-api';
import {
  Palette, Plus, Pencil, X, Check, ToggleLeft, ToggleRight,
  Sparkles, Loader2, ExternalLink, Star, Crown, Zap,
  Trash2, Shield, Users, Copy, ChevronRight, Wand2, BookOpen,
  ChevronLeft, ImagePlus, Link,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getPlanDisplayName } from '@resort-pro/types';

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Theme {
  key:          string;
  name:         string;
  description:  string | null;
  previewImage: string | null;
  screenshots:  string[];
  author:       string;
  version:      string;
  tags:         string[];
  isActive:     boolean;
  isDefault:    boolean;
  isPremium:    boolean;
  requiredPlan: string;
  sortOrder:    number;
  usageCount:   number;
  createdAt:    string;
  // One-time sale price — 0 means the theme is free.
  priceUsd?:      string | number;
  priceBdt?:      string | number;
  offerPriceUsd?: string | number | null;
  offerPriceBdt?: string | number | null;
  offerEndsAt?:   string | null;
  // Dynamic theme fields
  themeType?:   'HARDCODED' | 'UPLOADED' | 'AI_GENERATED';
  themeStatus?: 'DRAFT' | 'PREVIEW' | 'PUBLISHED';
}

type TabId = 'all' | 'active' | 'premium' | 'inactive';

/* ── Constants ─────────────────────────────────────────────────────────────── */
const PLAN_OPTIONS = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
const PLAN_ICON: Record<string, React.ReactNode> = {
  STARTER:      <Zap className="h-3 w-3" />,
  PROFESSIONAL: <Crown className="h-3 w-3" />,
  ENTERPRISE:   <Shield className="h-3 w-3" />,
};
const PLAN_COLOR: Record<string, string> = {
  STARTER:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  PROFESSIONAL: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  ENTERPRISE:   'text-amber-400 bg-amber-500/10 border-amber-500/30',
};

/** Built-in themes have no remote preview image, so give each one a lightweight visual identity. */
const THEME_THUMBNAIL: Record<string, {
  canvas: string; bar: string; line: string; eyebrow: string; heading: string;
  copy: string; accent: string; panel: string; serif?: boolean;
}> = {
  luxe: {
    canvas: 'bg-[#183b35]', bar: 'bg-[#f8f1e4]/15', line: 'bg-[#f8f1e4]/30',
    eyebrow: 'text-[#d4a853]', heading: 'text-[#fffaf0]', copy: 'A quieter kind of luxury',
    accent: 'bg-[#d4a853]', panel: 'bg-[#f8f1e4]/10', serif: true,
  },
  coastal: {
    canvas: 'bg-[#dceff2]', bar: 'bg-white/70', line: 'bg-[#0d6f8c]/20',
    eyebrow: 'text-[#d97706]', heading: 'text-[#075d76]', copy: 'Slow days by the water',
    accent: 'bg-[#d97706]', panel: 'bg-white/80',
  },
  'tea-garden-eco-resort': {
    canvas: 'bg-[#e6edcf]', bar: 'bg-[#f8f4e8]/80', line: 'bg-[#1a6b2a]/20',
    eyebrow: 'text-[#7b7f17]', heading: 'text-[#1a4d25]', copy: 'Wake up among the leaves',
    accent: 'bg-[#1a6b2a]', panel: 'bg-[#f8f4e8]/85', serif: true,
  },
  minimal: {
    canvas: 'bg-[#f8fafc]', bar: 'bg-white', line: 'bg-[#0f172a]/10',
    eyebrow: 'text-[#2563eb]', heading: 'text-[#0f172a]', copy: 'Room for the essentials',
    accent: 'bg-[#2563eb]', panel: 'bg-white',
  },
};

const EMPTY_FORM = {
  name: '', description: '', previewImage: '', screenshots: [] as string[], author: 'ResortPro Team',
  version: '1.0.0', tags: '', isPremium: false, requiredPlan: 'STARTER', sortOrder: 99,
  // Kept as strings so the inputs can be cleared while typing; converted on save.
  priceUsd: '30', priceBdt: '3000', offerPriceUsd: '', offerPriceBdt: '', offerEndsAt: '',
};

/**
 * Prices are stored in USD and BDT separately rather than converted at runtime,
 * so an owner's BDT price never moves with the exchange rate. This is the fixed
 * rate the rest of the app already prices at (PLAN_PRICING: $10 → ৳1000), used
 * only to pre-fill the BDT box — the admin can always type a different number.
 */
const USD_TO_BDT = 100;

const SECTIONS_LIST = [
  'hero', 'about', 'rooms', 'gallery', 'testimonials',
  'availability', 'booking', 'contact', 'menu', 'facilities',
];

const BRIEF_EMPTY = {
  name: '', key: '', description: '',
  primary: '#1a6b5e', accent: '#d4a853', background: '#ffffff',
  headingFont: 'serif' as 'serif' | 'sans-serif',
  heroStyle: 'fullscreen' as 'fullscreen' | 'split' | 'minimal' | 'magazine',
  mood: '',
  sections: ['hero', 'about', 'rooms', 'gallery', 'testimonials', 'availability', 'booking', 'contact'],
  specialNotes: '',
  requiredPlan: 'STARTER',
  isPremium: false,
};

/* ── Helpers ───────────────────────────────────────────────────────────────── */
function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function generateBrief(f: typeof BRIEF_EMPTY): string {
  const heroMap = {
    fullscreen: 'Full-screen (image fills entire viewport)',
    split:      'Split layout (text left, image right)',
    minimal:    'Minimal centered card',
    magazine:   'Bold/Magazine style (large typography)',
  };
  return `=== THEME BRIEF ===

Key:         ${f.key || toSlug(f.name) || '<key>'}
Name:        ${f.name || '<Theme Name>'}
Description: ${f.description || '<Short description>'}

Colors:
  Primary:    ${f.primary}
  Accent:     ${f.accent}
  Background: ${f.background}

Typography:
  Headings:   ${f.headingFont === 'serif' ? 'Serif' : 'Sans-serif'}
  Body:       Sans-serif

Layout Style:
  Hero:       ${heroMap[f.heroStyle]}

Mood/Feel:   ${f.mood || '<e.g. Tropical + Vibrant, Mountain + Earthy>'}

Sections to include:
  ${f.sections.map(s => `[✓] ${s}`).join('  ')}

Special requests:
  ${f.specialNotes || '(none)'}

Required Plan: ${f.requiredPlan}
Premium: ${f.isPremium ? 'Yes' : 'No'}

=== END BRIEF ===

---

Claude-কে বলো:
"ResortPro project-এ নতুন theme বানাতে হবে। \`plan/theme-system.md\` এর "Part B — Theme Development Guide" পড়ো। নিচের brief অনুযায়ী theme তৈরি করো:

[উপরের brief paste করো]"`;
}

/* ── Small components ──────────────────────────────────────────────────────── */
function ThemeThumbnail({ theme }: { theme: Theme }) {
  const visual = THEME_THUMBNAIL[theme.key] ?? {
    canvas: 'bg-[#eff2f3]', bar: 'bg-white', line: 'bg-[#201e1d]/10',
    eyebrow: 'text-[#ec3013]', heading: 'text-[#201e1d]', copy: 'A distinctive resort stay',
    accent: 'bg-[#ec3013]', panel: 'bg-white',
  };

  return (
    <div role="img" aria-label={`${theme.name} website thumbnail`} className={`relative h-full w-full overflow-hidden ${visual.canvas}`}>
      <div className={`absolute inset-x-0 top-0 flex h-7 items-center justify-between px-3 ${visual.bar}`}>
        <span className={`h-1.5 w-9 ${visual.line}`} />
        <span className={`h-1.5 w-14 ${visual.line}`} />
      </div>
      <div className="absolute inset-x-0 top-7 h-px bg-black/5" />
      <div className="absolute inset-x-0 top-7 bottom-0 px-4 pt-5">
        <p className={`text-[7px] font-bold uppercase tracking-[0.22em] ${visual.eyebrow}`}>ResortPro stay</p>
        <p className={`mt-1 max-w-[12rem] text-[19px] leading-[0.94] ${visual.serif ? 'font-serif' : 'font-semibold'} ${visual.heading}`}>{visual.copy}</p>
        <span className={`mt-3 block h-1.5 w-14 ${visual.accent}`} />
      </div>
      <div className="absolute inset-x-4 bottom-3 grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((index) => (
          <div key={index} className={`h-8 border border-black/5 p-1.5 ${visual.panel}`}>
            <span className={`block h-1 w-5 ${visual.line}`} />
            <span className={`mt-1.5 block h-1 w-7 ${visual.line}`} />
          </div>
        ))}
      </div>
      <div className={`absolute -right-5 -top-7 h-24 w-24 rounded-full opacity-20 ${visual.accent}`} />
    </div>
  );
}

function FieldInput({
  label, value, onChange, placeholder, type = 'text', colSpan = 1,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; colSpan?: 1 | 2;
}) {
  return (
    <div className={colSpan === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
    </div>
  );
}

function PlanSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="col-span-2">
      <label className="block text-xs font-medium text-gray-400 mb-2">Required Plan</label>
      <div className="flex gap-2">
        {PLAN_OPTIONS.map(plan => (
          <button key={plan} type="button" onClick={() => onChange(plan)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 border ${
              value === plan ? PLAN_COLOR[plan] : 'text-gray-600 bg-gray-800 border-gray-700 hover:bg-gray-700'
            }`}>
            {PLAN_ICON[plan]} {getPlanDisplayName(plan)}
          </button>
        ))}
      </div>
    </div>
  );
}

function PremiumToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="col-span-2">
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div onClick={() => onChange(!value)}
          className={`w-10 h-5 rounded-full transition-colors relative ${value ? 'bg-amber-500' : 'bg-gray-700'}`}>
          <div className={`absolute top-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
        <span className="text-sm text-gray-300">Mark as Premium</span>
        {value && <Sparkles className="h-3.5 w-3.5 text-amber-400" />}
      </label>
    </div>
  );
}

/**
 * One-time sale price for a theme, plus an optional running offer.
 *
 * Typing a USD price pre-fills BDT at the app's fixed ৳100 = $1 rate, but the
 * BDT box stays independently editable: the two are stored separately on
 * purpose so a Bangladeshi owner's price never drifts with the exchange rate,
 * and so it can be a round ৳3000 rather than whatever a live rate produced.
 * Set the price to 0 to give a theme away free.
 */
function PricingEditor({
  form, setForm,
}: {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
}) {
  const priceNum = Number(form.priceUsd) || 0;
  const offerNum = form.offerPriceUsd === '' ? null : Number(form.offerPriceUsd);
  const offerTooHigh = offerNum !== null && Number.isFinite(offerNum) && offerNum > priceNum;

  const money = (v: string) => v.replace(/[^\d.]/g, '');

  return (
    <div className="mt-5 rounded-xl border border-gray-800 bg-gray-950/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">One-time price</span>
        {priceNum === 0 && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">Free theme</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">Price (USD)</label>
          <input
            inputMode="decimal"
            value={form.priceUsd}
            onChange={e => {
              const usd = money(e.target.value);
              setForm(p => ({
                ...p,
                priceUsd: usd,
                // Keep BDT in step while the admin types, but never overwrite a
                // BDT figure they set by hand to something off the fixed rate.
                priceBdt: (p.priceBdt === '' || Number(p.priceBdt) === Number(p.priceUsd) * USD_TO_BDT)
                  ? String((Number(usd) || 0) * USD_TO_BDT)
                  : p.priceBdt,
              }));
            }}
            placeholder="30"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">Price (BDT)</label>
          <input
            inputMode="decimal"
            value={form.priceBdt}
            onChange={e => setForm(p => ({ ...p, priceBdt: money(e.target.value) }))}
            placeholder="3000"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Offer <span className="font-normal normal-case tracking-normal text-gray-600">— leave blank for no offer</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">Offer (USD)</label>
          <input
            inputMode="decimal"
            value={form.offerPriceUsd}
            onChange={e => {
              const usd = money(e.target.value);
              setForm(p => ({
                ...p,
                offerPriceUsd: usd,
                offerPriceBdt: usd === '' ? '' : String((Number(usd) || 0) * USD_TO_BDT),
              }));
            }}
            placeholder="—"
            className={`w-full rounded-lg border bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 ${offerTooHigh ? 'border-red-500 focus:ring-red-500' : 'border-gray-700 focus:ring-indigo-500'}`}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">Offer (BDT)</label>
          <input
            inputMode="decimal"
            value={form.offerPriceBdt}
            onChange={e => setForm(p => ({ ...p, offerPriceBdt: money(e.target.value) }))}
            placeholder="—"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">Offer ends</label>
          <input
            type="date"
            value={form.offerEndsAt}
            onChange={e => setForm(p => ({ ...p, offerEndsAt: e.target.value }))}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {offerTooHigh && (
        <p className="mt-2 text-xs font-semibold text-red-400">
          Offer price is higher than the normal price — the server will reject this.
        </p>
      )}
      {!offerTooHigh && form.offerPriceUsd !== '' && !form.offerEndsAt && (
        <p className="mt-2 text-xs text-gray-500">No end date — this offer runs until you clear it.</p>
      )}
    </div>
  );
}

/**
 * Price at a glance on the theme card. An offer that has passed its end date is
 * shown as expired rather than as the live price — the same thing the server
 * will conclude at checkout, so the catalogue never advertises a discount that
 * would no longer be honoured.
 */
function ThemePriceBadge({ theme }: { theme: Theme }) {
  const price = Number(theme.priceUsd ?? 0);
  if (!price) {
    return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">Free</span>;
  }

  const offer = theme.offerPriceUsd != null ? Number(theme.offerPriceUsd) : null;
  const expired = !!theme.offerEndsAt && new Date(theme.offerEndsAt).getTime() < Date.now();
  const offerLive = offer !== null && !expired;

  return (
    <span className="flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs">
      {offerLive ? (
        <>
          <span className="text-gray-500 line-through">${price}</span>
          <span className="font-semibold text-amber-400">${offer}</span>
        </>
      ) : (
        <span className="font-semibold text-gray-200">${price}</span>
      )}
      {offer !== null && expired && <span className="text-[10px] text-gray-500">offer ended</span>}
    </span>
  );
}

/* ── Theme Card ────────────────────────────────────────────────────────────── */
function ThemeCard({
  theme, onEdit, onToggle, onSetDefault, onDelete, togglePending,
}: {
  theme: Theme;
  onEdit: () => void;
  onToggle: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
  togglePending: boolean;
}) {
  const allImages = [theme.previewImage, ...theme.screenshots].filter(Boolean) as string[];
  const [imgIdx, setImgIdx] = useState(0);

  const prevImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIdx(i => (i - 1 + allImages.length) % allImages.length);
  };
  const nextImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIdx(i => (i + 1) % allImages.length);
  };

  return (
    <div className={`bg-gray-900 border rounded-2xl overflow-hidden flex flex-col transition-all hover:border-gray-700 group ${
      theme.isActive ? 'border-gray-800' : 'border-gray-800/40 opacity-60'
    }`}>

      {/* Preview image — with carousel if multiple */}
      <div className="relative aspect-video w-full bg-gray-800 overflow-hidden flex-shrink-0">
        {allImages.length > 0
          ? <img src={allImages[imgIdx]} alt={theme.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <ThemeThumbnail theme={theme} />
        }

        {/* Carousel controls — only if multiple images */}
        {allImages.length > 1 && (
          <>
            <button onClick={prevImg}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={nextImg}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70">
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {allImages.map((_, i) => (
                <button key={i} onClick={e => { e.stopPropagation(); setImgIdx(i); }}
                  className={`h-1.5 rounded-full transition-all ${i === imgIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`} />
              ))}
            </div>
          </>
        )}

        {/* Status overlay badges */}
        <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
          {theme.isDefault && (
            <span className="text-xs text-yellow-300 bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Star className="h-3 w-3 fill-current" /> Default
            </span>
          )}
          {theme.isPremium && (
            <span className="text-xs text-amber-300 bg-amber-500/20 backdrop-blur-sm border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Premium
            </span>
          )}
          {!theme.isActive && (
            <span className="text-xs text-gray-400 bg-gray-900/60 backdrop-blur-sm border border-gray-700 px-2 py-0.5 rounded-full">
              Inactive
            </span>
          )}
          {theme.themeType === 'UPLOADED' && (
            <span className="text-xs text-green-300 bg-green-500/20 backdrop-blur-sm border border-green-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <ImagePlus className="h-2.5 w-2.5" /> Uploaded
            </span>
          )}
          {theme.themeType === 'AI_GENERATED' && (
            <span className="text-xs text-purple-300 bg-purple-500/20 backdrop-blur-sm border border-purple-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Wand2 className="h-2.5 w-2.5" /> AI
            </span>
          )}
          {(theme.themeType === 'UPLOADED' || theme.themeType === 'AI_GENERATED') && theme.themeStatus === 'DRAFT' && (
            <span className="text-xs text-orange-300 bg-orange-500/20 backdrop-blur-sm border border-orange-500/30 px-2 py-0.5 rounded-full">
              Draft
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1 gap-3">
        {/* Name + key */}
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-white">{theme.name}</span>
            <code className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full font-mono">{theme.key}</code>
            <span className="text-xs text-gray-600">v{theme.version}</span>
          </div>
          <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">
            {theme.description ?? 'No description'}
          </p>
        </div>

        {/* Tags */}
        {theme.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {theme.tags.slice(0, 4).map(tag => (
              <span key={tag} className="text-xs text-gray-500 bg-gray-800 border border-gray-700/50 px-2 py-0.5 rounded-full">{tag}</span>
            ))}
          </div>
        )}

        {/* Plan + price + installs */}
        <div className="flex items-center gap-2 flex-wrap mt-auto">
          <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 border ${PLAN_COLOR[theme.requiredPlan] ?? 'text-gray-400 bg-gray-700 border-gray-600'}`}>
            {PLAN_ICON[theme.requiredPlan]} {getPlanDisplayName(theme.requiredPlan)}
          </span>
          <ThemePriceBadge theme={theme} />
          <span className="text-xs text-gray-500 flex items-center gap-1 ml-auto">
            <Users className="h-3 w-3" />
            {theme.usageCount} {theme.usageCount === 1 ? 'resort' : 'resorts'}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800" />

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Preview */}
          <a href={`/theme-preview/${theme.key}`} target="_blank" rel="noopener noreferrer"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors" title="Preview theme in new tab">
            <ExternalLink className="h-4 w-4" />
          </a>

          {/* Set Default */}
          {!theme.isDefault && theme.isActive && (
            <button onClick={onSetDefault}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-600 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors" title="Set as default">
              <Star className="h-4 w-4" />
            </button>
          )}

          {/* Edit */}
          <button onClick={onEdit}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 transition-colors" title="Edit metadata">
            <Pencil className="h-4 w-4" />
          </button>

          {/* Delete */}
          {!theme.isDefault && (
            <button onClick={onDelete}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-700 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Remove theme">
              <Trash2 className="h-4 w-4" />
            </button>
          )}

          {/* Toggle — pushed right */}
          <button onClick={onToggle} disabled={togglePending}
            className={`ml-auto h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors ${
              theme.isActive
                ? 'text-green-400 hover:bg-red-500/10 hover:text-red-400'
                : 'text-gray-500 hover:bg-green-500/10 hover:text-green-400'
            }`}>
            {theme.isActive ? <><ToggleRight className="h-4 w-4" /> On</> : <><ToggleLeft className="h-4 w-4" /> Off</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Edit Modal ────────────────────────────────────────────────────────────── */
function ScreenshotsEditor({ screenshots, onChange }: {
  screenshots: string[];
  onChange: (s: string[]) => void;
}) {
  const [newUrl, setNewUrl] = useState('');

  const add = () => {
    const url = newUrl.trim();
    if (url && !screenshots.includes(url)) {
      onChange([...screenshots, url]);
      setNewUrl('');
    }
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
        <ImagePlus className="h-3.5 w-3.5" /> Screenshots ({screenshots.length})
      </label>

      {/* Existing screenshots */}
      {screenshots.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {screenshots.map((url, i) => (
            <div key={i} className="relative group/img aspect-video rounded-lg overflow-hidden border border-gray-700">
              <img src={url} alt={`screenshot ${i + 1}`} className="w-full h-full object-cover" />
              <button onClick={() => onChange(screenshots.filter((_, j) => j !== i))}
                className="absolute inset-0 bg-red-900/70 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new URL */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Link className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
          <input
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
            placeholder="https://images.unsplash.com/..."
            className="w-full pl-8 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <button onClick={add} disabled={!newUrl.trim()}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
      <p className="text-xs text-gray-600 mt-1.5">Paste an image URL and press Add or Enter. These show in the card carousel.</p>
    </div>
  );
}

function EditModal({
  theme, onClose, onSave, saving,
}: {
  theme: Theme;
  onClose: () => void;
  onSave: (form: typeof EMPTY_FORM) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<typeof EMPTY_FORM>({
    name: theme.name,
    description: theme.description ?? '',
    previewImage: theme.previewImage ?? '',
    screenshots: theme.screenshots ?? [],
    author: theme.author,
    version: theme.version,
    tags: theme.tags.join(', '),
    isPremium: theme.isPremium,
    requiredPlan: theme.requiredPlan,
    sortOrder: theme.sortOrder,
    priceUsd: theme.priceUsd != null ? String(Number(theme.priceUsd)) : '30',
    priceBdt: theme.priceBdt != null ? String(Number(theme.priceBdt)) : '3000',
    offerPriceUsd: theme.offerPriceUsd != null ? String(Number(theme.offerPriceUsd)) : '',
    offerPriceBdt: theme.offerPriceBdt != null ? String(Number(theme.offerPriceBdt)) : '',
    // <input type="date"> needs a bare YYYY-MM-DD, not a full ISO timestamp.
    offerEndsAt: theme.offerEndsAt ? theme.offerEndsAt.slice(0, 10) : '',
  });

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl pointer-events-auto max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
            <div>
              <h2 className="font-bold text-white">Edit Theme</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                <code className="text-indigo-400">{theme.key}</code> — metadata only
              </p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FieldInput label="Theme Name *" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="Luxe Gold" />
              <FieldInput label="Author" value={form.author} onChange={v => setForm(p => ({ ...p, author: v }))} placeholder="ResortPro Team" />
              <FieldInput label="Version" value={form.version} onChange={v => setForm(p => ({ ...p, version: v }))} placeholder="1.0.0" />
              <FieldInput label="Sort Order" value={String(form.sortOrder)} onChange={v => setForm(p => ({ ...p, sortOrder: parseInt(v) || 0 }))} type="number" />
              <FieldInput colSpan={2} label="Description" value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} placeholder="Short description for resort owners" />
              <FieldInput colSpan={2} label="Tags (comma separated)" value={form.tags} onChange={v => setForm(p => ({ ...p, tags: v }))} placeholder="Luxury, Gold Accents, Full-Screen Hero" />
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Main Preview Image URL</label>
                <input type="url" value={form.previewImage} onChange={e => setForm(p => ({ ...p, previewImage: e.target.value }))}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                {form.previewImage && (
                  <img src={form.previewImage} alt="preview" className="mt-2 h-24 w-36 rounded-lg object-cover border border-gray-700" />
                )}
              </div>
              <div className="col-span-2">
                <ScreenshotsEditor
                  screenshots={form.screenshots}
                  onChange={s => setForm(p => ({ ...p, screenshots: s }))}
                />
              </div>
              <PlanSelector value={form.requiredPlan} onChange={v => setForm(p => ({ ...p, requiredPlan: v }))} />
              <PremiumToggle value={form.isPremium} onChange={v => setForm(p => ({ ...p, isPremium: v }))} />
            </div>

            <PricingEditor form={form} setForm={setForm} />
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
            <button onClick={() => onSave(form)} disabled={!form.name || saving}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : <><Check className="h-3.5 w-3.5" /> Save Changes</>}
            </button>
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Add Theme Modal (2-tab wizard) ────────────────────────────────────────── */
function AddThemeModal({ onClose, onRegister, registering }: {
  onClose: () => void;
  onRegister: (form: typeof addForm) => void;
  registering: boolean;
}) {
  type ModalTab = 'register' | 'brief';
  const [tab, setTab] = useState<ModalTab>('register');
  const [addForm, setAddForm] = useState({ key: '', ...EMPTY_FORM });
  const [brief, setBrief] = useState<typeof BRIEF_EMPTY>({ ...BRIEF_EMPTY });
  const [generatedBrief, setGeneratedBrief] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    const b = generateBrief({ ...brief, key: brief.key || toSlug(brief.name) });
    setGeneratedBrief(b);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedBrief);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const TAB_ITEMS: { id: ModalTab; label: string; icon: React.ReactNode }[] = [
    { id: 'register', label: 'Register Existing', icon: <Plus className="h-3.5 w-3.5" /> },
    { id: 'brief',    label: 'Create New Theme', icon: <Wand2 className="h-3.5 w-3.5" /> },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className={`w-full bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl pointer-events-auto max-h-[92vh] overflow-y-auto flex flex-col ${
          tab === 'brief' ? 'max-w-2xl' : 'max-w-lg'
        }`} onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
            <h2 className="font-bold text-white flex items-center gap-2">
              <Palette className="h-5 w-5 text-indigo-400" /> Add Theme
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-6 pt-4 pb-0">
            {TAB_ITEMS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors border-b-2 ${
                  tab === t.id
                    ? 'text-indigo-400 border-indigo-500 bg-indigo-500/5'
                    : 'text-gray-500 border-transparent hover:text-gray-300'
                }`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-800" />

          {/* Tab: Register Existing */}
          {tab === 'register' && (
            <>
              <div className="p-6 space-y-4">
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-400 flex gap-2">
                  <BookOpen className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Theme <strong>key</strong> must match a registered component in{' '}
                    <code className="font-mono">themes/registry.ts</code>. Use the{' '}
                    <button className="underline" onClick={() => setTab('brief')}>"Create New Theme" tab</button> to get a brief for Claude first.
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Key (slug) *</label>
                    <input value={addForm.key}
                      onChange={e => setAddForm(p => ({ ...p, key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                      placeholder="e.g. mountain"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <FieldInput label="Sort Order" value={String(addForm.sortOrder)}
                    onChange={v => setAddForm(p => ({ ...p, sortOrder: parseInt(v) || 99 }))} type="number" />
                  <FieldInput colSpan={2} label="Name *" value={addForm.name}
                    onChange={v => setAddForm(p => ({ ...p, name: v }))} placeholder="Mountain Escape" />
                  <FieldInput colSpan={2} label="Description" value={addForm.description}
                    onChange={v => setAddForm(p => ({ ...p, description: v }))} placeholder="Short description" />
                  <FieldInput colSpan={2} label="Tags (comma separated)" value={addForm.tags}
                    onChange={v => setAddForm(p => ({ ...p, tags: v }))} placeholder="Luxury, Modern" />
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Preview Image URL</label>
                    <input type="url" value={addForm.previewImage}
                      onChange={e => setAddForm(p => ({ ...p, previewImage: e.target.value }))}
                      placeholder="https://..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <PlanSelector value={addForm.requiredPlan} onChange={v => setAddForm(p => ({ ...p, requiredPlan: v }))} />
                  <PremiumToggle value={addForm.isPremium} onChange={v => setAddForm(p => ({ ...p, isPremium: v }))} />
                </div>
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
                <button onClick={() => onRegister(addForm)} disabled={!addForm.key || !addForm.name || registering}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                  {registering ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding…</> : <><Plus className="h-3.5 w-3.5" /> Register Theme</>}
                </button>
                <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
              </div>
            </>
          )}

          {/* Tab: Create New Theme (Brief Generator) */}
          {tab === 'brief' && (
            <div className="p-6 space-y-6">
              {!generatedBrief ? (
                <>
                  <p className="text-sm text-gray-400">
                    Fill in the details below → generate a Theme Brief → give it to Claude to build the theme code.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Name */}
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Theme Name *</label>
                      <input value={brief.name}
                        onChange={e => {
                          const n = e.target.value;
                          setBrief(p => ({ ...p, name: n, key: p.key || toSlug(n) }));
                        }}
                        placeholder="Mountain Escape"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>

                    {/* Key */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Key (slug) *</label>
                      <input value={brief.key}
                        onChange={e => setBrief(p => ({ ...p, key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                        placeholder="mountain"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Mood / Feel</label>
                      <input value={brief.mood} onChange={e => setBrief(p => ({ ...p, mood: e.target.value }))}
                        placeholder="Earthy, Warm, Nature-inspired"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>

                    {/* Colors */}
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-2">Color Palette</label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Primary', key: 'primary' as const },
                          { label: 'Accent', key: 'accent' as const },
                          { label: 'Background', key: 'background' as const },
                        ].map(c => (
                          <div key={c.key}>
                            <label className="block text-xs text-gray-500 mb-1">{c.label}</label>
                            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
                              <input type="color" value={brief[c.key]}
                                onChange={e => setBrief(p => ({ ...p, [c.key]: e.target.value }))}
                                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0" />
                              <span className="text-xs text-gray-400 font-mono">{brief[c.key]}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Heading font */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">Heading Font</label>
                      <div className="flex gap-2">
                        {(['serif', 'sans-serif'] as const).map(f => (
                          <button key={f} type="button" onClick={() => setBrief(p => ({ ...p, headingFont: f }))}
                            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors border ${
                              brief.headingFont === f ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' : 'text-gray-500 bg-gray-800 border-gray-700'
                            }`}>
                            {f === 'serif' ? 'Serif' : 'Sans'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Hero style */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">Hero Style</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {([
                          { id: 'fullscreen', label: 'Full-screen' },
                          { id: 'split', label: 'Split' },
                          { id: 'minimal', label: 'Minimal' },
                          { id: 'magazine', label: 'Magazine' },
                        ] as const).map(s => (
                          <button key={s.id} type="button"
                            onClick={() => setBrief(p => ({ ...p, heroStyle: s.id }))}
                            className={`py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                              brief.heroStyle === s.id ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' : 'text-gray-500 bg-gray-800 border-gray-700'
                            }`}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sections */}
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-2">Sections to include</label>
                      <div className="flex flex-wrap gap-2">
                        {SECTIONS_LIST.map(s => {
                          const selected = brief.sections.includes(s);
                          return (
                            <button key={s} type="button"
                              onClick={() => setBrief(p => ({
                                ...p,
                                sections: selected
                                  ? p.sections.filter(x => x !== s)
                                  : [...p.sections, s],
                              }))}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border capitalize ${
                                selected ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' : 'text-gray-600 bg-gray-800 border-gray-700 hover:text-gray-400'
                              }`}>
                              {selected && <Check className="h-2.5 w-2.5 inline mr-1" />}
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Special notes */}
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Special Requests (optional)</label>
                      <textarea value={brief.specialNotes} rows={2}
                        onChange={e => setBrief(p => ({ ...p, specialNotes: e.target.value }))}
                        placeholder="e.g. Hero-তে parallax effect চাই, Room cards-এ hover zoom..."
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none" />
                    </div>

                    <PlanSelector value={brief.requiredPlan} onChange={v => setBrief(p => ({ ...p, requiredPlan: v }))} />
                    <PremiumToggle value={brief.isPremium} onChange={v => setBrief(p => ({ ...p, isPremium: v }))} />
                  </div>

                  <button onClick={handleGenerate} disabled={!brief.name || !brief.key}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors">
                    <Wand2 className="h-4 w-4" /> Generate Theme Brief
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              ) : (
                /* Generated brief */
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-white">Theme Brief Generated</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Copy and give to Claude to build the theme code</p>
                    </div>
                    <button onClick={() => setGeneratedBrief('')}
                      className="text-xs text-gray-500 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors">
                      ← Edit
                    </button>
                  </div>

                  <div className="relative bg-gray-950 border border-gray-700 rounded-xl p-4 font-mono text-xs text-gray-300 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                    {generatedBrief}
                    <button onClick={handleCopy}
                      className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-xs text-gray-300 transition-colors">
                      {copied ? <><Check className="h-3 w-3 text-green-400" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy</>}
                    </button>
                  </div>

                  <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-4 py-3 text-xs text-indigo-300 space-y-1">
                    <p className="font-semibold">Next steps:</p>
                    <p>1. Copy the brief above</p>
                    <p>2. Open Claude Code → paste the brief with the prompt shown at the bottom</p>
                    <p>3. Claude builds the theme code following <code className="font-mono">plan/theme-system.md</code></p>
                    <p>4. Once code is deployed, come back here → "Register Existing" tab → add the theme key</p>
                  </div>

                  <button onClick={handleCopy}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors">
                    {copied ? <><Check className="h-4 w-4" /> Copied to clipboard!</> : <><Copy className="h-4 w-4" /> Copy Theme Brief</>}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Upload Theme Modal ─────────────────────────────────────────────────────── */
function UploadThemeModal({
  onClose, onSuccess,
}: { onClose: () => void; onSuccess: (key: string) => void }) {
  const [step, setStep]     = useState<'upload' | 'preview'>('upload');
  const [file, setFile]     = useState<File | null>(null);
  const [drag, setDrag]     = useState(false);
  const [result, setResult] = useState<{ key: string; name: string; previewUrl: string } | null>(null);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleUpload() {
    if (!file) return;
    setLoading(true); setError('');
    try {
      const r = await adminEndpoints.uploadTheme(file);
      setResult(r.data.data);
      setStep('preview');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Upload failed');
    } finally { setLoading(false); }
  }

  async function handlePublish() {
    if (!result) return;
    setLoading(true);
    try {
      await adminEndpoints.publishTheme(result.key, 'PUBLISHED');
      onSuccess(result.key);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Publish failed');
    } finally { setLoading(false); }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg pointer-events-auto">

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <h2 className="font-bold text-white flex items-center gap-2">
                <ImagePlus className="h-5 w-5 text-indigo-400" /> Upload Theme Package
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {step === 'upload' ? 'Step 1 — Select .html, .json, or .zip file' : 'Step 2 — Preview & Publish'}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            {step === 'upload' ? (
              <>
                {/* Drop zone */}
                <label
                  className={`flex flex-col items-center justify-center gap-3 p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-colors ${
                    drag ? 'border-indigo-500 bg-indigo-500/5' : 'border-gray-700 hover:border-gray-600'
                  }`}
                  onDragOver={e => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
                >
                  <input type="file" accept=".html,.htm,.json,.zip" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  <ImagePlus className="h-10 w-10 text-gray-600" />
                  <div className="text-center">
                    <p className="text-sm text-gray-400">Drag & drop or click to browse</p>
                    <p className="text-xs text-gray-600 mt-1">Accepted: .html (template), .json, or .zip (max 512 KB)</p>
                  </div>
                  {file && (
                    <div className="flex items-center gap-2 mt-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-3 py-2">
                      <Check className="h-4 w-4 text-indigo-400" />
                      <span className="text-sm text-indigo-300">{file.name}</span>
                    </div>
                  )}
                </label>

                {/* HTML template hint */}
                <details className="mt-4 text-xs text-gray-600">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-300 transition-colors">
                    See required .html template format
                  </summary>
                  <div className="mt-2 p-3 bg-gray-800 rounded-lg text-[11px] text-gray-400 space-y-1.5">
                    <p>One <code className="text-indigo-300">.html</code> file — CSS goes inside a <code className="text-indigo-300">&lt;style&gt;</code> tag in the same file, not a separate .css file.</p>
                    <p>Data tokens: <code className="text-indigo-300">{'{{tenant.name}}'}</code>, <code className="text-indigo-300">{'{{website.heroTitle}}'}</code>, <code className="text-indigo-300">{'{{#each rooms}}'}</code> …</p>
                    <p>Widget mounts: <code className="text-indigo-300">data-rp-widget=&quot;booking&quot;</code> (also: availability, menu, venues, vehicles, contact, offers, social-links).</p>
                    <p>Required section ids: <code className="text-indigo-300">id=&quot;rooms&quot;</code> and <code className="text-indigo-300">id=&quot;booking&quot;</code> — the owner can never hide these.</p>
                    <p>No <code className="text-indigo-300">&lt;script&gt;</code>, inline <code className="text-indigo-300">on*=</code> handlers, <code className="text-indigo-300">javascript:</code> URLs, or <code className="text-indigo-300">fetch</code>/<code className="text-indigo-300">eval</code> — these get rejected automatically.</p>
                    <p className="text-gray-500">Full spec: <code className="text-indigo-300">plan/theme-contract.md</code></p>
                  </div>
                </details>

                {/* JSON format hint */}
                <details className="mt-3 text-xs text-gray-600">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-300 transition-colors">
                    See required config.json format
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-800 rounded-lg text-[10px] text-gray-400 overflow-auto">{`{
  "key": "my-resort-theme",
  "name": "My Resort Theme",
  "colors": { "primary": "#1a6b5e", "accent": "#d4a853",
    "background": "#fff", "surface": "#f9fafb",
    "text": "#111827", "textMuted": "#6b7280" },
  "fonts": { "heading": "serif", "body": "sans-serif" },
  "navbar": { "style": "transparent-to-white", "logoEmoji": "🏨" },
  "hero": { "layout": "fullscreen", "overlayOpacity": 0.5,
    "textAlign": "center", "ctaStyle": "pill", "showStats": true },
  "sections": ["hero","about","rooms","gallery",
    "testimonials","availability","booking","contact"]
}`}</pre>
                </details>

                {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

                <div className="flex gap-3 mt-6">
                  <button onClick={onClose}
                    className="flex-1 py-2.5 border border-gray-700 text-gray-400 text-sm rounded-xl hover:bg-gray-800 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleUpload} disabled={!file || loading}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Validate & Upload
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl mb-5">
                  <Check className="h-5 w-5 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-300">{result?.name} — validated ✓</p>
                    <p className="text-xs text-green-400/70 mt-0.5">Key: {result?.key}</p>
                  </div>
                </div>

                <a
                  href={`/theme-preview/${result?.key}`}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center gap-2 w-full py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm rounded-xl transition-colors justify-center mb-4"
                >
                  <ExternalLink className="h-4 w-4" /> Preview Theme in New Tab
                </a>

                {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

                <div className="flex gap-3">
                  <button onClick={onClose}
                    className="flex-1 py-2.5 border border-gray-700 text-gray-400 text-sm rounded-xl hover:bg-gray-800 transition-colors">
                    Save as Draft
                  </button>
                  <button onClick={handlePublish} disabled={loading}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Publish Theme
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── AI Builder Modal ────────────────────────────────────────────────────────── */
const QUICK_STYLE_OPTIONS = [
  { id: 'luxury',    label: '✨ Luxury' },
  { id: 'eco',       label: '🌿 Eco/Nature' },
  { id: 'modern',    label: '🏙️ Modern' },
  { id: 'beach',     label: '🏖️ Beach' },
  { id: 'mountain',  label: '🏔️ Mountain' },
  { id: 'heritage',  label: '🏛️ Heritage' },
  { id: 'boutique',  label: '🌸 Boutique' },
  { id: 'minimalist',label: '⬜ Minimalist' },
];

function AIBuilderModal({
  onClose, onSuccess,
}: { onClose: () => void; onSuccess: (key: string) => void }) {
  const qc = useQueryClient();
  const [step,          setStep]          = useState<'configure' | 'generate' | 'preview'>('configure');
  const [prompt,        setPrompt]        = useState('');
  const [quickOptions,  setQuickOptions]  = useState<string[]>([]);
  const [apiKey,        setApiKey]        = useState('');
  const [savingKey,     setSavingKey]     = useState(false);
  const [keySaved,      setKeySaved]      = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [result,        setResult]        = useState<{ key: string; name: string } | null>(null);
  const [error,         setError]         = useState('');
  const [generating,    setGenerating]    = useState(false);
  const [publishing,    setPublishing]    = useState(false);

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-settings'],
    queryFn:  () => adminEndpoints.getAiSettings().then(r => r.data.data),
  });

  async function handleSaveKey() {
    if (!apiKey.trim()) return;
    setSavingKey(true);
    try {
      await adminEndpoints.saveAiApiKey(apiKey.trim(), 'claude');
      qc.invalidateQueries({ queryKey: ['ai-settings'] });
      setKeySaved(true);
    } catch { setError('Failed to save API key'); }
    finally { setSavingKey(false); }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await adminEndpoints.disconnectAi();
      qc.invalidateQueries({ queryKey: ['ai-settings'] });
      setKeySaved(false);
      setApiKey('');
    } catch { setError('Failed to disconnect'); }
    finally { setDisconnecting(false); }
  }

  async function handleGenerate() {
    if (prompt.trim().length < 10) { setError('Please write at least 10 characters'); return; }
    setGenerating(true); setError(''); setStep('generate');
    try {
      const r = await adminEndpoints.generateTheme({ prompt, quickOptions });
      setResult(r.data.data);
      setStep('preview');
    } catch (e: any) {
      setError(e.response?.data?.error || 'AI generation failed');
      setStep('configure');
    } finally { setGenerating(false); }
  }

  async function handlePublish() {
    if (!result) return;
    setPublishing(true);
    try {
      await adminEndpoints.publishTheme(result.key, 'PUBLISHED');
      onSuccess(result.key);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Publish failed');
    } finally { setPublishing(false); }
  }

  const isConfigured = aiStatus?.configured || keySaved;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-xl pointer-events-auto">

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <h2 className="font-bold text-white flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-purple-400" /> Build Theme with AI
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {step === 'configure' && 'Describe your theme — AI generates the config instantly'}
                {step === 'generate'  && 'Claude is generating your theme…'}
                {step === 'preview'   && 'Theme generated! Preview & publish.'}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-5">

            {/* Step: generating spinner */}
            {step === 'generate' && (
              <div className="flex flex-col items-center py-12 gap-4">
                <div className="relative">
                  <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
                  <Wand2 className="h-5 w-5 text-purple-300 absolute top-3.5 left-3.5" />
                </div>
                <p className="text-gray-400 text-sm">Claude is designing your theme…</p>
                <p className="text-xs text-gray-600">Usually takes 5–15 seconds</p>
              </div>
            )}

            {/* Step: preview */}
            {step === 'preview' && result && (
              <>
                <div className="flex items-center gap-3 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                  <Sparkles className="h-5 w-5 text-purple-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-purple-300">{result.name} — generated!</p>
                    <p className="text-xs text-purple-400/70 mt-0.5">Key: {result.key}</p>
                  </div>
                </div>

                <a
                  href={`/theme-preview/${result.key}`}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center gap-2 w-full py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm rounded-xl transition-colors justify-center"
                >
                  <ExternalLink className="h-4 w-4" /> Preview in New Tab
                </a>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <div className="flex gap-3">
                  <button
                    onClick={() => { setStep('configure'); setResult(null); setError(''); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-700 text-gray-400 text-sm rounded-xl hover:bg-gray-800 transition-colors"
                  >
                    <Wand2 className="h-3.5 w-3.5" /> Regenerate
                  </button>
                  <button onClick={onClose}
                    className="flex-1 py-2.5 border border-gray-700 text-gray-400 text-sm rounded-xl hover:bg-gray-800 transition-colors">
                    Save as Draft
                  </button>
                  <button onClick={handlePublish} disabled={publishing}
                    className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                    {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Publish
                  </button>
                </div>
              </>
            )}

            {/* Step: configure */}
            {step === 'configure' && (
              <>
                {/* API key section */}
                <div className={`p-4 rounded-xl border ${isConfigured ? 'border-green-500/30 bg-green-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: isConfigured ? '#4ade80' : '#fbbf24' }}>
                      Claude API
                    </p>
                    {isConfigured
                      ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-400 flex items-center gap-1"><Check className="h-3 w-3" /> Connected</span>
                          <button
                            onClick={handleDisconnect}
                            disabled={disconnecting}
                            className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 rounded px-2 py-0.5 hover:bg-red-500/10 transition-colors flex items-center gap-1"
                          >
                            {disconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                            Disconnect
                          </button>
                        </div>
                      )
                      : <span className="text-xs text-yellow-400">Not configured</span>
                    }
                  </div>
                  {!isConfigured && (
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="sk-ant-api03-..."
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      <button
                        onClick={handleSaveKey}
                        disabled={savingKey || !apiKey.trim()}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1"
                      >
                        {savingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Save
                      </button>
                    </div>
                  )}
                </div>

                {/* Prompt textarea */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Describe your theme
                  </label>
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    rows={4}
                    placeholder="e.g. একটা হিল রিসোর্টের জন্য theme চাই। রঙ সবুজ এবং সোনালি। serif heading। hero full screen। misty পাহাড়ের feel।"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    English বা Bangla — যেকোনো ভাষায় লিখতে পারো
                  </p>
                </div>

                {/* Quick style chips */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">Quick style hints</label>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_STYLE_OPTIONS.map(o => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setQuickOptions(prev =>
                          prev.includes(o.id) ? prev.filter(x => x !== o.id) : [...prev, o.id]
                        )}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          quickOptions.includes(o.id)
                            ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                            : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <div className="flex gap-3 pt-2">
                  <button onClick={onClose}
                    className="flex-1 py-2.5 border border-gray-700 text-gray-400 text-sm rounded-xl hover:bg-gray-800 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={!isConfigured || prompt.trim().length < 10 || generating}
                    className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Wand2 className="h-4 w-4" /> Generate Theme (~$0.02)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function AdminThemesPage() {
  const qc = useQueryClient();
  const [activeTab,   setActiveTab]   = useState<TabId>('all');
  const [editTheme,   setEditTheme]   = useState<Theme | null>(null);
  const [showAdd,     setShowAdd]     = useState(false);
  const [showUpload,  setShowUpload]  = useState(false);
  const [showAI,      setShowAI]      = useState(false);
  const [showMenu,    setShowMenu]    = useState(false);
  const [delKey,      setDelKey]      = useState<string | null>(null);

  /* ── Data ──────────────────────────────────────────────────────────────── */
  const { data, isLoading } = useQuery<Theme[]>({
    queryKey: ['admin-themes'],
    queryFn:  () => adminEndpoints.getThemes().then(r => r.data.data),
  });

  /* ── Mutations ─────────────────────────────────────────────────────────── */
  const saveMut = useMutation({
    mutationFn: ({ key, form }: { key: string; form: typeof EMPTY_FORM }) =>
      adminEndpoints.updateTheme(key, {
        name: form.name, description: form.description || undefined,
        previewImage: form.previewImage || undefined,
        screenshots: form.screenshots,
        author: form.author, version: form.version,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        isPremium: form.isPremium, requiredPlan: form.requiredPlan, sortOrder: Number(form.sortOrder),
        priceUsd: Number(form.priceUsd) || 0,
        priceBdt: Number(form.priceBdt) || 0,
        // Empty box means "no offer" — send null so a running offer is cleared
        // rather than left in place because the field was simply omitted.
        offerPriceUsd: form.offerPriceUsd === '' ? null : Number(form.offerPriceUsd),
        offerPriceBdt: form.offerPriceBdt === '' ? null : Number(form.offerPriceBdt),
        offerEndsAt: form.offerEndsAt === '' ? null : form.offerEndsAt,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-themes'] });
      setEditTheme(null);
      toast({ title: '✓ Theme saved' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' }),
  });

  const addMut = useMutation({
    mutationFn: (f: { key: string } & typeof EMPTY_FORM) =>
      adminEndpoints.updateTheme(f.key, {
        name: f.name, description: f.description || undefined,
        previewImage: f.previewImage || undefined, author: f.author,
        version: f.version, tags: f.tags.split(',').map(t => t.trim()).filter(Boolean),
        isPremium: f.isPremium, requiredPlan: f.requiredPlan,
        sortOrder: Number(f.sortOrder), isActive: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-themes'] });
      setShowAdd(false);
      toast({ title: '✓ Theme registered' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to register theme', variant: 'destructive' }),
  });

  const toggleMut = useMutation({
    mutationFn: (key: string) => adminEndpoints.toggleTheme(key),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-themes'] }); toast({ title: 'Theme status updated' }); },
    onError:   () => toast({ title: 'Error', description: 'Failed to toggle', variant: 'destructive' }),
  });

  const setDefaultMut = useMutation({
    mutationFn: (key: string) => adminEndpoints.updateTheme(key, { isDefault: true } as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-themes'] }); toast({ title: '✓ Default theme set' }); },
    onError:   () => toast({ title: 'Error', variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (key: string) => adminEndpoints.updateTheme(key, { isActive: false } as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-themes'] }); setDelKey(null); toast({ title: 'Theme removed' }); },
    onError:   () => toast({ title: 'Error', variant: 'destructive' }),
  });

  const realDeleteMut = useMutation({
    mutationFn: (key: string) => adminEndpoints.deleteTheme(key),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-themes'] }); setDelKey(null); toast({ title: 'Theme deleted' }); },
    onError:   (e: any) => toast({ title: 'Error', description: e.response?.data?.error || 'Delete failed', variant: 'destructive' }),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );

  const themes = data ?? [];
  const totalInstalls = themes.reduce((s, t) => s + t.usageCount, 0);

  const TAB_ITEMS: { id: TabId; label: string; count: number }[] = [
    { id: 'all',      label: 'All',      count: themes.length },
    { id: 'active',   label: 'Active',   count: themes.filter(t => t.isActive).length },
    { id: 'premium',  label: 'Premium',  count: themes.filter(t => t.isPremium).length },
    { id: 'inactive', label: 'Inactive', count: themes.filter(t => !t.isActive).length },
  ];

  const filtered = themes.filter(t => {
    if (activeTab === 'active')   return t.isActive;
    if (activeTab === 'premium')  return t.isPremium;
    if (activeTab === 'inactive') return !t.isActive;
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Palette className="h-6 w-6 text-indigo-400" /> Theme Management
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage resort themes. Active themes appear in the owner theme picker.
          </p>
        </div>
        {/* Add Theme dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(m => !m)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Plus className="h-4 w-4" /> Add Theme
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showMenu ? 'rotate-90' : ''}`} />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-52 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                <button
                  onClick={() => { setShowMenu(false); setShowAdd(true); }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  <BookOpen className="h-4 w-4 text-indigo-400" />
                  <div className="text-left">
                    <p className="font-medium">Brief Generator</p>
                    <p className="text-xs text-gray-500">Generate brief for developer</p>
                  </div>
                </button>
                <div className="h-px bg-gray-800" />
                <button
                  onClick={() => { setShowMenu(false); setShowUpload(true); }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  <ImagePlus className="h-4 w-4 text-green-400" />
                  <div className="text-left">
                    <p className="font-medium">Upload Package</p>
                    <p className="text-xs text-gray-500">Upload .json or .zip config</p>
                  </div>
                </button>
                <div className="h-px bg-gray-800" />
                <button
                  onClick={() => { setShowMenu(false); setShowAI(true); }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  <Wand2 className="h-4 w-4 text-purple-400" />
                  <div className="text-left">
                    <p className="font-medium">Build with AI</p>
                    <p className="text-xs text-gray-500">Claude generates the theme</p>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Themes', value: themes.length, color: 'text-white' },
          { label: 'Active',       value: themes.filter(t => t.isActive).length, color: 'text-green-400' },
          { label: 'Premium',      value: themes.filter(t => t.isPremium).length, color: 'text-amber-400' },
          { label: 'Total Installs', value: totalInstalls, color: 'text-indigo-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {TAB_ITEMS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.id
                ? 'text-indigo-400 border-indigo-500'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}>
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === t.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-gray-800 text-gray-500'
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Theme Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl">
          <Palette className="h-10 w-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No themes in this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(theme => (
            <ThemeCard
              key={theme.key}
              theme={theme}
              onEdit={() => setEditTheme(theme)}
              onToggle={() => toggleMut.mutate(theme.key)}
              onSetDefault={() => setDefaultMut.mutate(theme.key)}
              onDelete={() => setDelKey(theme.key)}
              togglePending={toggleMut.isPending}
            />
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editTheme && (
        <EditModal
          theme={editTheme}
          onClose={() => setEditTheme(null)}
          onSave={form => saveMut.mutate({ key: editTheme.key, form })}
          saving={saveMut.isPending}
        />
      )}

      {/* Add Modal */}
      {showAdd && (
        <AddThemeModal
          onClose={() => setShowAdd(false)}
          onRegister={f => addMut.mutate(f as any)}
          registering={addMut.isPending}
        />
      )}

      {/* Upload Theme Modal */}
      {showUpload && (
        <UploadThemeModal
          onClose={() => setShowUpload(false)}
          onSuccess={key => {
            qc.invalidateQueries({ queryKey: ['admin-themes'] });
            setShowUpload(false);
            toast({ title: `✓ Theme published: ${key}` });
          }}
        />
      )}

      {/* AI Builder Modal */}
      {showAI && (
        <AIBuilderModal
          onClose={() => setShowAI(false)}
          onSuccess={key => {
            qc.invalidateQueries({ queryKey: ['admin-themes'] });
            setShowAI(false);
            toast({ title: `✓ AI Theme published: ${key}` });
          }}
        />
      )}

      {/* Delete Confirm */}
      {delKey && (() => {
        const t = themes.find(x => x.key === delKey);
        const isCustom = t?.themeType === 'UPLOADED' || t?.themeType === 'AI_GENERATED';
        return (
          <>
            <div className="fixed inset-0 z-50 bg-black/70" onClick={() => setDelKey(null)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full pointer-events-auto">
                <h3 className="font-bold text-white mb-2">{isCustom ? 'Delete Theme?' : 'Remove Theme?'}</h3>
                <p className="text-sm text-gray-400 mb-5">
                  Theme <code className="text-indigo-400">{delKey}</code> will be{' '}
                  {isCustom ? 'permanently deleted' : 'deactivated and hidden from resort owners'}.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => isCustom ? realDeleteMut.mutate(delKey) : deleteMut.mutate(delKey)}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    {isCustom ? 'Delete' : 'Remove'}
                  </button>
                  <button onClick={() => setDelKey(null)}
                    className="flex-1 py-2 border border-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-800 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
