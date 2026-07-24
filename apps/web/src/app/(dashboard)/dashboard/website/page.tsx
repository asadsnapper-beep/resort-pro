'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { websiteApi, tenantApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/hooks/use-toast';
import {
  Globe, Image, FileText, Palette, Star, Plus, Trash2, Save,
  Layout, LayoutGrid, ExternalLink, Share2, Link2, CheckCircle2,
  AlertTriangle, Loader2, PanelRight, PanelRightClose, RefreshCw,
  Monitor, Smartphone, Copy, Check, ChevronUp, ChevronDown,
} from 'lucide-react';
import { ThemePicker } from '@/components/dashboard/website/ThemePicker';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { ModalShell } from '@/components/ui/modal-shell';

const PREVIEW_STORAGE_KEY = 'rp-website-preview';

interface WebsiteContent {
  heroTitle: string;
  heroSubtitle?: string;
  heroImage?: string;
  aboutTitle?: string;
  aboutText?: string;
  aboutImage?: string;
  galleryImages?: string[];
  seoTitle?: string;
  seoDescription?: string;
  primaryColor?: string;
  accentColor?: string;
  testimonials?: { name: string; text: string; rating: number; avatar?: string }[];
  templateId?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  tiktokUrl?: string;
  youtubeUrl?: string;
  whatsappNumber?: string;
  tripadvisorUrl?: string;
  hiddenSections?: string[];
  sectionOrder?: string[];
  googleAnalyticsId?: string;
}

// Orderable site sections. `fixed: true` = always visible (no hide toggle),
// but still reorderable. Order here is the default page order.
const SITE_SECTIONS = [
  { id: 'about',        label: 'About / Our Story',     desc: 'Resort story, about image' },
  { id: 'amenities',    label: 'Amenities',              desc: 'Pool, spa, gym etc. (Coastal theme)' },
  { id: 'rooms',        label: 'Rooms & Villas',         desc: 'Room cards with prices & booking', fixed: true },
  { id: 'menu',         label: 'Restaurant Menu',        desc: 'Food menu with in-room ordering' },
  { id: 'venues',       label: 'Venues & Events',        desc: 'Conference hall, banquet, lawn — with enquiry form' },
  { id: 'vehicles',     label: 'Vehicle Rental',         desc: 'Cars, bikes, scooties, cycles — with enquiry form' },
  { id: 'gallery',      label: 'Photo Gallery',          desc: 'Image gallery grid' },
  { id: 'testimonials', label: 'Testimonials',           desc: 'Guest reviews & ratings' },
  { id: 'availability', label: 'Availability Calendar',  desc: 'Date picker to check open rooms' },
  { id: 'booking',      label: 'Booking Form',           desc: 'Direct reservation form', fixed: true },
  { id: 'contact',      label: 'Contact / Feedback',     desc: 'Contact form and map' },
] as const;

const DEFAULT_SECTION_ORDER = SITE_SECTIONS.map(s => s.id);

/** Resolve saved order → full valid order (unknown ids dropped, missing appended). */
function resolveSectionOrder(saved?: string[]): string[] {
  if (!saved || saved.length === 0) return [...DEFAULT_SECTION_ORDER];
  const known = new Set<string>(DEFAULT_SECTION_ORDER);
  const out = saved.filter(id => known.has(id));
  for (const id of DEFAULT_SECTION_ORDER) if (!out.includes(id)) out.push(id);
  return out;
}

const TABS = [
  { id: 'template',     label: 'Template',      icon: Layout     },
  { id: 'hero',         label: 'Hero & About',  icon: Globe      },
  { id: 'gallery',      label: 'Gallery',        icon: Image      },
  { id: 'testimonials', label: 'Testimonials',   icon: Star       },
  { id: 'sections',     label: 'Sections',       icon: LayoutGrid },
  { id: 'seo',          label: 'SEO & Branding', icon: Palette    },
  { id: 'social',       label: 'Social Media',   icon: Share2     },
  { id: 'domain',       label: 'Custom Domain',  icon: Link2      },
] as const;

type Tab = typeof TABS[number]['id'];

const inputCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30';
const labelCls = 'block text-[11.5px] font-medium text-[#6b8880] mb-1.5';
const cardCls  = 'rounded-[14px] border bg-white p-5 space-y-4';
const cardStyle = { borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' };

function SaveBtn({ loading, dirty, onClick }: { loading: boolean; dirty?: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center gap-2.5">
      {dirty && !loading && (
        <span className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.25)', color: '#b89040' }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#b89040' }} />
          Unsaved changes
        </span>
      )}
      <button onClick={onClick} disabled={loading || !dirty}
        title={dirty ? 'Review & publish your changes' : 'No changes to publish'}
        className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-60 hover:opacity-90"
        style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {loading ? 'Publishing…' : 'Save & Publish'}
      </button>
    </div>
  );
}

export default function WebsitePage() {
  const queryClient = useQueryClient();
  const { tenant } = useAuthStore();
  const [tab, setTab] = useState<Tab>('template');
  const [showPreview, setShowPreview] = useState(true);
  const [previewKey,  setPreviewKey]  = useState(0);
  const [urlCopied,   setUrlCopied]   = useState(false);
  const [mobileView,  setMobileView]  = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [form, setForm] = useState<WebsiteContent>({
    heroTitle: '', heroSubtitle: '', heroImage: '',
    aboutTitle: '', aboutText: '', aboutImage: '',
    galleryImages: [], seoTitle: '', seoDescription: '',
    primaryColor: '#1a6b5e', accentColor: '#d4a853',
    testimonials: [], templateId: 'luxe',
    facebookUrl: '', instagramUrl: '', twitterUrl: '',
    tiktokUrl: '', youtubeUrl: '', whatsappNumber: '',
    tripadvisorUrl: '', hiddenSections: [], sectionOrder: [], googleAnalyticsId: '',
  });

  const { data, isLoading } = useQuery({ queryKey: ['website'], queryFn: () => websiteApi.get() });

  useEffect(() => {
    const content = data?.data?.data;
    if (content) {
      const loaded: WebsiteContent = {
        heroTitle:        content.heroTitle        ?? '',
        heroSubtitle:     content.heroSubtitle     ?? '',
        heroImage:        content.heroImage        ?? '',
        aboutTitle:       content.aboutTitle       ?? '',
        aboutText:        content.aboutText        ?? '',
        aboutImage:       content.aboutImage       ?? '',
        galleryImages:    content.galleryImages    ?? [],
        seoTitle:         content.seoTitle         ?? '',
        seoDescription:   content.seoDescription  ?? '',
        primaryColor:     content.primaryColor     ?? '#1a6b5e',
        accentColor:      content.accentColor      ?? '#d4a853',
        testimonials:     content.testimonials     ?? [],
        templateId:       content.templateId       ?? 'luxe',
        facebookUrl:      content.facebookUrl      ?? '',
        instagramUrl:     content.instagramUrl     ?? '',
        twitterUrl:       content.twitterUrl       ?? '',
        tiktokUrl:        content.tiktokUrl        ?? '',
        youtubeUrl:       content.youtubeUrl       ?? '',
        whatsappNumber:   content.whatsappNumber   ?? '',
        tripadvisorUrl:   content.tripadvisorUrl   ?? '',
        hiddenSections:   content.hiddenSections   ?? [],
        sectionOrder:     content.sectionOrder     ?? [],
        googleAnalyticsId: content.googleAnalyticsId ?? '',
      };
      setForm(loaded);
      setSavedSnapshot(JSON.stringify(loaded));
    }
  }, [data]);

  // Unsaved-changes tracking + tab-close guard
  const dirty = savedSnapshot !== null && JSON.stringify(form) !== savedSnapshot;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const sendPreviewUpdate = useCallback((payload: WebsiteContent) => {
    try { sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(payload)); } catch {}
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'rp-preview-update', payload }, window.location.origin,
    );
  }, []);

  useEffect(() => {
    const t = setTimeout(() => sendPreviewUpdate(form), 600);
    return () => clearTimeout(t);
  }, [form, sendPreviewUpdate]);

  const saveMutation = useMutation({
    mutationFn: () => websiteApi.update(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website'] });
      setSavedSnapshot(JSON.stringify(form));
      setConfirmOpen(false);
      toast({ title: '🎉 Published!', description: `Your website is live at ${tenant?.slug}.resortpro.site` });
      setPreviewKey(k => k + 1);
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to save', variant: 'destructive' }),
  });

  const set = (k: keyof WebsiteContent, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const addTestimonial    = () => set('testimonials', [...(form.testimonials ?? []), { name: '', text: '', rating: 5 }]);
  const setTestimonial    = (i: number, key: string, value: unknown) =>
    set('testimonials', (form.testimonials ?? []).map((t, idx) => idx === i ? { ...t, [key]: value } : t));
  const removeTestimonial = (i: number) =>
    set('testimonials', (form.testimonials ?? []).filter((_, idx) => idx !== i));

  const publicUrl  = tenant?.slug ? `/${tenant.slug}` : null;
  const previewUrl = tenant?.slug ? `/${tenant.slug}?preview=${form.templateId ?? 'luxe'}` : null;

  /* ── Setup checklist — drives owners to a complete, publishable site ────── */
  const checklist: { label: string; done: boolean; tab: Tab }[] = [
    { label: 'Add a hero photo',            done: !!form.heroImage,                          tab: 'hero' },
    { label: 'Write your resort story',     done: (form.aboutText ?? '').trim().length >= 40, tab: 'hero' },
    { label: 'Add at least 3 gallery photos', done: (form.galleryImages ?? []).length >= 3,  tab: 'gallery' },
    { label: 'Add a guest testimonial',     done: (form.testimonials ?? []).length >= 1,     tab: 'testimonials' },
    { label: 'Set your SEO title',          done: !!(form.seoTitle ?? '').trim(),            tab: 'seo' },
    { label: 'Add your WhatsApp number',    done: !!(form.whatsappNumber ?? '').trim(),      tab: 'social' },
  ];
  const checklistDone = checklist.filter(c => c.done).length;
  const checklistPct  = Math.round((checklistDone / checklist.length) * 100);

  /* ── Custom domain ──────────────────────────────────────────────────────── */
  const [domainInput, setDomainInput] = useState('');
  const [domainInfo, setDomainInfo]   = useState<{
    customDomain: string | null;
    domainVerified: boolean;
    domainVerifiedAt: string | null;
    cnameTarget?: string;
  } | null>(null);

  const { data: tenantData } = useQuery({ queryKey: ['tenant-domain'], queryFn: () => tenantApi.get() });

  useEffect(() => {
    const t = tenantData?.data?.data;
    if (t) {
      setDomainInfo({
        customDomain:     t.customDomain    ?? null,
        domainVerified:   t.domainVerified  ?? false,
        domainVerifiedAt: t.domainVerifiedAt ?? null,
        cnameTarget: t.slug ? `${t.slug}.resortpro.site` : undefined,
      });
      if (t.customDomain) setDomainInput(t.customDomain);
    }
  }, [tenantData]);

  const setDomainMut = useMutation({
    mutationFn: (domain: string | null) => tenantApi.setDomain(domain),
    onSuccess: (res, domain) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-domain'] });
      const d = res?.data?.data;
      if (d) setDomainInfo(prev => ({ ...prev!, ...d }));
      toast({ title: domain ? 'Domain saved!' : 'Domain removed', description: domain ? 'Click "Verify Domain" once DNS is configured.' : undefined });
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to save domain', variant: 'destructive' }),
  });

  const verifyMut = useMutation({
    mutationFn: () => tenantApi.verifyDomain(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-domain'] });
      const d = res?.data?.data;
      if (d?.verified) {
        setDomainInfo(prev => ({ ...prev!, domainVerified: true, domainVerifiedAt: new Date().toISOString() }));
        toast({ title: '✓ Domain verified!', description: `${domainInfo?.customDomain} is now live.` });
      }
    },
    onError: (err: { response?: { data?: { error?: string; message?: string } } }) =>
      toast({ title: 'Verification failed', description: err?.response?.data?.message ?? err?.response?.data?.error ?? 'DNS not configured yet', variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-7 w-48 rounded-[8px] animate-pulse" style={{ background: '#e8e5e0' }} />
        <div className="h-64 rounded-[14px] animate-pulse" style={{ background: 'var(--rp-surface-4)' }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -mx-4 sm:-mx-6 lg:-mx-8 overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 flex-shrink-0 gap-3"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'var(--rp-surface-2)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <h1 className="font-display text-[18px] font-medium tracking-[-0.01em] leading-none text-[#18231f] dark:text-[#dfd9d0]">Website Builder</h1>
            <p className="text-[11.5px] mt-0.5 hidden sm:block text-[#7a9890] dark:text-[#94b8b0]">Design and publish your public resort website</p>
          </div>
          {publicUrl && (
            <span className="hidden sm:flex items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-[11px] font-semibold"
              style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }}>
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: '#4ade80' }} /> Live
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowPreview(v => !v)} title={showPreview ? 'Hide preview' : 'Show preview'}
            className="hidden lg:flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors"
            style={showPreview
              ? { background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }
              : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            {showPreview ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRight className="h-3.5 w-3.5" />}
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>

          {publicUrl && (
            <button onClick={() => window.open(publicUrl, '_blank')}
              className="hidden sm:flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-[#f4f1eb]"
              style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
              <ExternalLink className="h-3.5 w-3.5" /> Live Site
            </button>
          )}

          <SaveBtn loading={saveMutation.isPending} dirty={dirty} onClick={() => setConfirmOpen(true)} />
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────────── */}
      <div className={`flex flex-1 min-h-0 ${showPreview ? 'lg:grid lg:grid-cols-[440px_1fr]' : ''}`}>

        {/* ── LEFT editor panel ──────────────────────────────────────────────── */}
        <div className="flex flex-col min-h-0" style={{ borderRight: '1px solid rgba(0,0,0,0.07)' }}>

          {/* Tab bar — wraps so ALL tabs stay visible (no hidden horizontal scroll) */}
          <div className="flex flex-wrap gap-0 flex-shrink-0 px-3"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'var(--rp-surface-2)' }}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap"
                style={tab === id
                  ? { borderColor: '#23766a', color: '#23766a' }
                  : { borderColor: 'transparent', color: 'var(--rp-text-muted)' }}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5" style={{ background: '#f7f5f0' }}>

            {/* Live URL banner — canonical public address + copy */}
            {publicUrl && tenant?.slug && (
              <div className="flex items-center gap-2 rounded-[10px] border px-3 py-2"
                style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)' }}>
                <Globe className="h-3.5 w-3.5 shrink-0" style={{ color: '#23766a' }} />
                <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[12px] font-semibold truncate hover:underline" style={{ color: '#23766a' }}>
                  {tenant.slug}.resortpro.site
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://${tenant.slug}.resortpro.site`);
                    setUrlCopied(true);
                    setTimeout(() => setUrlCopied(false), 1500);
                  }}
                  title="Copy site address"
                  className="ml-auto flex shrink-0 items-center gap-1 rounded-[7px] border px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-white/60"
                  style={{ borderColor: 'rgba(35,118,106,0.25)', color: '#23766a' }}>
                  {urlCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {urlCopied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={() => window.open(publicUrl, '_blank')}
                  title="Open site"
                  className="flex shrink-0 items-center gap-1 rounded-[7px] border px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-white/60"
                  style={{ borderColor: 'rgba(35,118,106,0.25)', color: '#23766a' }}>
                  <ExternalLink className="h-3 w-3" /> Open
                </button>
              </div>
            )}

            {/* Setup checklist — hidden once everything is done */}
            {checklistPct < 100 && (
              <div className={cardCls} style={cardStyle}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[13.5px] font-bold text-[#18231f]">Your site is {checklistPct}% ready</h3>
                    <p className="text-[11.5px] text-[#8aa29a]">Finish these to make a great first impression</p>
                  </div>
                  <span className="text-[12px] font-bold" style={{ color: '#23766a' }}>{checklistDone}/{checklist.length}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--rp-surface-3)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${checklistPct}%`, background: '#23766a' }} />
                </div>
                <ul className="space-y-1.5">
                  {checklist.map(item => (
                    <li key={item.label}>
                      <button
                        onClick={() => !item.done && setTab(item.tab)}
                        disabled={item.done}
                        className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[12.5px] transition-colors disabled:cursor-default enabled:hover:bg-black/[0.03]">
                        {item.done
                          ? <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: '#23766a' }} />
                          : <span className="h-4 w-4 shrink-0 rounded-full border-2" style={{ borderColor: 'rgba(0,0,0,0.15)' }} />}
                        <span style={item.done ? { color: '#8aa29a', textDecoration: 'line-through' } : { color: '#18231f' }}>
                          {item.label}
                        </span>
                        {!item.done && <span className="ml-auto text-[11px] font-semibold" style={{ color: '#23766a' }}>Fix →</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Template tab ─────────────────────────────────────────────── */}
            {tab === 'template' && tenant?.slug && (
              <ThemePicker
                currentTheme={form.templateId ?? 'luxe'}
                slug={tenant.slug}
                onSelect={(key) => set('templateId', key)}
              />
            )}

            {/* ── Hero & About tab ──────────────────────────────────────────── */}
            {tab === 'hero' && (
              <div className="space-y-4">
                <div className={cardCls} style={cardStyle}>
                  <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">
                    <div className="flex h-7 w-7 items-center justify-center rounded-[7px]" style={{ background: 'var(--rp-teal-bg)' }}>
                      <Globe className="h-3.5 w-3.5" style={{ color: '#23766a' }} />
                    </div>
                    Hero Section
                  </h3>
                  <div>
                    <label className={labelCls}>Hero Title *</label>
                    <input value={form.heroTitle} onChange={e => set('heroTitle', e.target.value)}
                      placeholder="Welcome to Paradise" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Hero Subtitle</label>
                    <input value={form.heroSubtitle ?? ''} onChange={e => set('heroSubtitle', e.target.value)}
                      placeholder="Experience luxury at its finest" className={inputCls} />
                  </div>
                  <ImageUpload
                    value={form.heroImage ?? null}
                    onChange={url => set('heroImage', url ?? '')}
                    folder="website"
                    label="Hero Background Image"
                    hint="Recommended: 1920×1080px landscape photo"
                    aspectRatio="wide"
                  />
                </div>

                <div className={cardCls} style={cardStyle}>
                  <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">
                    <div className="flex h-7 w-7 items-center justify-center rounded-[7px]" style={{ background: 'var(--rp-amber-bg)' }}>
                      <FileText className="h-3.5 w-3.5" style={{ color: '#b89040' }} />
                    </div>
                    About Section
                  </h3>
                  <div>
                    <label className={labelCls}>About Title</label>
                    <input value={form.aboutTitle ?? ''} onChange={e => set('aboutTitle', e.target.value)}
                      placeholder="Our Story" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>About Text</label>
                    <textarea value={form.aboutText ?? ''} onChange={e => set('aboutText', e.target.value)}
                      rows={4} placeholder="Tell guests about your property…"
                      className={inputCls + ' resize-none'} />
                  </div>
                  <ImageUpload
                    value={form.aboutImage ?? null}
                    onChange={url => set('aboutImage', url ?? '')}
                    folder="website"
                    label="About Section Image"
                    hint="Recommended: square or portrait photo"
                    aspectRatio="video"
                  />
                </div>
              </div>
            )}

            {/* ── Gallery tab ──────────────────────────────────────────────── */}
            {tab === 'gallery' && (
              <div className={cardCls} style={cardStyle}>
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">
                    <div className="flex h-7 w-7 items-center justify-center rounded-[7px]" style={{ background: 'var(--rp-coral-bg)' }}>
                      <Image className="h-3.5 w-3.5" style={{ color: '#b8724a' }} />
                    </div>
                    Gallery Images
                  </h3>
                  <span className="text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">{(form.galleryImages ?? []).length} photos</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(form.galleryImages ?? []).map((url, i) => (
                    <div key={i} className="group relative aspect-video rounded-[10px] overflow-hidden"
                      style={{ background: 'var(--rp-surface-4)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Gallery ${i + 1}`} className="h-full w-full object-cover" />
                      <button
                        onClick={() => set('galleryImages', (form.galleryImages ?? []).filter((_, idx) => idx !== i))}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ background: 'rgba(27,52,47,0.7)', color: 'var(--rp-btn-accent-text)' }}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {(form.galleryImages ?? []).length < 20 && (
                    <ImageUpload
                      value={null}
                      onChange={url => { if (url) set('galleryImages', [...(form.galleryImages ?? []), url]); }}
                      folder="website"
                      aspectRatio="video"
                    />
                  )}
                </div>
              </div>
            )}

            {/* ── Testimonials tab ──────────────────────────────────────────── */}
            {tab === 'testimonials' && (
              <div className={cardCls} style={cardStyle}>
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">
                    <div className="flex h-7 w-7 items-center justify-center rounded-[7px]" style={{ background: 'var(--rp-amber-bg)' }}>
                      <Star className="h-3.5 w-3.5" style={{ color: '#b89040' }} />
                    </div>
                    Guest Testimonials
                  </h3>
                  <button onClick={addTestimonial}
                    className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] font-medium hover:bg-[#f4f1eb]"
                    style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>

                {(form.testimonials ?? []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 rounded-[12px] border-2 border-dashed"
                    style={{ borderColor: 'rgba(184,144,64,0.25)', background: '#fdfbf6' }}>
                    <Star className="h-9 w-9 mb-3" style={{ color: '#e8d5a0' }} />
                    <p className="text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">No testimonials yet</p>
                    <button onClick={addTestimonial}
                      className="mt-3 flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium hover:opacity-90"
                      style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                      <Plus className="h-3.5 w-3.5" /> Add First Testimonial
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(form.testimonials ?? []).map((t, i) => (
                      <div key={i} className="rounded-[12px] border p-4 space-y-3"
                        style={{ borderColor: 'var(--rp-border)', background: 'var(--rp-surface-2)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[12.5px] font-medium text-[#6b8880] dark:text-[#94b8b0]">Testimonial #{i + 1}</span>
                          <button onClick={() => removeTestimonial(i)}
                            className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] transition-colors hover:bg-[#fef2f2] text-[#c5bdb4] dark:text-[#6e8580]">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>Guest Name</label>
                            <input value={t.name} onChange={e => setTestimonial(i, 'name', e.target.value)}
                              placeholder="John Smith" className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>Rating</label>
                            <select value={t.rating} onChange={e => setTestimonial(i, 'rating', parseInt(e.target.value))}
                              className={inputCls + ' cursor-pointer'}>
                              {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{'★'.repeat(r)} ({r}/5)</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Review Text</label>
                          <textarea value={t.text} onChange={e => setTestimonial(i, 'text', e.target.value)}
                            rows={2} placeholder="What did they say about the stay?"
                            className={inputCls + ' resize-none'} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── SEO & Branding tab ────────────────────────────────────────── */}
            {tab === 'seo' && (
              <div className="space-y-4">
                <div className={cardCls} style={cardStyle}>
                  <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">
                    <div className="flex h-7 w-7 items-center justify-center rounded-[7px]" style={{ background: 'var(--rp-teal-bg)' }}>
                      <FileText className="h-3.5 w-3.5" style={{ color: '#23766a' }} />
                    </div>
                    SEO Settings
                  </h3>
                  <div>
                    <label className={labelCls}>SEO Title</label>
                    <input value={form.seoTitle ?? ''} onChange={e => set('seoTitle', e.target.value)}
                      placeholder="Palm Paradise Resort — Luxury Stays" className={inputCls} />
                    <p className="mt-1 text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">{(form.seoTitle ?? '').length}/60 characters recommended</p>
                  </div>
                  <div>
                    <label className={labelCls}>Meta Description</label>
                    <textarea value={form.seoDescription ?? ''} onChange={e => set('seoDescription', e.target.value)}
                      rows={3} placeholder="Experience luxury like never before…"
                      className={inputCls + ' resize-none'} />
                    <p className="mt-1 text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">{(form.seoDescription ?? '').length}/160 characters recommended</p>
                  </div>
                  <div>
                    <label className={labelCls}>Google Analytics ID</label>
                    <input value={form.googleAnalyticsId ?? ''} onChange={e => set('googleAnalyticsId', e.target.value)}
                      placeholder="G-XXXXXXXXXX" className={inputCls} />
                    <p className="mt-1 text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">
                      Your GA4 Measurement ID — find it in{' '}
                      <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer"
                        className="underline" style={{ color: '#23766a' }}>Google Analytics</a>
                      {' '}→ Admin → Data Streams.
                    </p>
                  </div>
                </div>

                <div className={cardCls} style={cardStyle}>
                  <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">
                    <div className="flex h-7 w-7 items-center justify-center rounded-[7px]" style={{ background: 'var(--rp-amber-bg)' }}>
                      <Palette className="h-3.5 w-3.5" style={{ color: '#b89040' }} />
                    </div>
                    Brand Colors
                  </h3>
                  <p className="text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">These colors apply to your selected template.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Primary Color</label>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={form.primaryColor ?? '#1a6b5e'} onChange={e => set('primaryColor', e.target.value)}
                          className="h-9 w-12 cursor-pointer rounded-[6px] border border-black/10" />
                        <input value={form.primaryColor ?? ''} onChange={e => set('primaryColor', e.target.value)}
                          placeholder="#1a6b5e" className={inputCls + ' font-mono'} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Accent Color</label>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={form.accentColor ?? '#d4a853'} onChange={e => set('accentColor', e.target.value)}
                          className="h-9 w-12 cursor-pointer rounded-[6px] border border-black/10" />
                        <input value={form.accentColor ?? ''} onChange={e => set('accentColor', e.target.value)}
                          placeholder="#d4a853" className={inputCls + ' font-mono'} />
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[10px] overflow-hidden border" style={{ borderColor: 'var(--rp-border)' }}>
                    <div className="p-3 text-[13px] font-semibold text-white" style={{ background: form.primaryColor ?? '#1a6b5e' }}>
                      Primary — Hero, Nav & Buttons
                    </div>
                    <div className="p-3 text-[13px] font-semibold" style={{ background: form.accentColor ?? '#d4a853' }}>
                      Accent — CTAs & Highlights
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Sections visibility tab ───────────────────────────────────── */}
            {tab === 'sections' && (() => {
              const order = resolveSectionOrder(form.sectionOrder);
              const move = (id: string, dir: -1 | 1) => {
                const idx = order.indexOf(id);
                const to  = idx + dir;
                if (to < 0 || to >= order.length) return;
                const next = [...order];
                [next[idx], next[to]] = [next[to], next[idx]];
                set('sectionOrder', next);
              };
              const byId = Object.fromEntries(SITE_SECTIONS.map(s => [s.id, s]));
              return (
                <div className={cardCls} style={cardStyle}>
                  <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">
                    <div className="flex h-7 w-7 items-center justify-center rounded-[7px]" style={{ background: 'var(--rp-teal-bg)' }}>
                      <LayoutGrid className="h-3.5 w-3.5" style={{ color: '#23766a' }} />
                    </div>
                    Page Sections
                  </h3>
                  <p className="text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">
                    Use the arrows to change the order sections appear on your website. Toggle to show or hide a section.
                  </p>
                  <div className="space-y-2.5">
                    {order.map((id, idx) => {
                      const sec = byId[id];
                      if (!sec) return null;
                      const isHidden = !sec.fixed && (form.hiddenSections ?? []).includes(sec.id);
                      const toggle = () => !sec.fixed && set('hiddenSections',
                        isHidden
                          ? (form.hiddenSections ?? []).filter(s => s !== sec.id)
                          : [...(form.hiddenSections ?? []), sec.id]
                      );
                      return (
                        <div key={sec.id}
                          className="flex items-center gap-3 rounded-[10px] border p-3 transition-all"
                          style={isHidden
                            ? { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)', opacity: 0.65 }
                            : { background: 'var(--rp-teal-soft)', borderColor: 'rgba(35,118,106,0.18)' }}>
                          {/* Reorder arrows */}
                          <div className="flex flex-col">
                            <button type="button" onClick={() => move(sec.id, -1)} disabled={idx === 0}
                              title="Move up"
                              className="flex h-5 w-6 items-center justify-center rounded-[5px] transition-colors disabled:opacity-25 enabled:hover:bg-black/[0.06]">
                              <ChevronUp className="h-3.5 w-3.5" style={{ color: '#23766a' }} />
                            </button>
                            <button type="button" onClick={() => move(sec.id, 1)} disabled={idx === order.length - 1}
                              title="Move down"
                              className="flex h-5 w-6 items-center justify-center rounded-[5px] transition-colors disabled:opacity-25 enabled:hover:bg-black/[0.06]">
                              <ChevronDown className="h-3.5 w-3.5" style={{ color: '#23766a' }} />
                            </button>
                          </div>
                          <div className="flex-1">
                            <p className="text-[13px] font-medium" style={{ color: isHidden ? 'var(--rp-text-muted)' : 'var(--rp-text)', textDecoration: isHidden ? 'line-through' : undefined }}>
                              {sec.label}
                            </p>
                            <p className="text-[11.5px] mt-0.5 text-[#c5bdb4] dark:text-[#6e8580]">{sec.desc}</p>
                          </div>
                          {sec.fixed ? (
                            <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold"
                              style={{ borderColor: 'rgba(35,118,106,0.25)', color: '#23766a' }}>
                              Always shown
                            </span>
                          ) : (
                            <button type="button" onClick={e => { e.stopPropagation(); toggle(); }}
                              className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
                              style={{ background: isHidden ? '#d6d0c8' : '#23766a' }}>
                              <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                                style={{ transform: isHidden ? 'translateX(4px)' : 'translateX(24px)' }} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => set('sectionOrder', [])}
                    className="text-[12px] font-medium underline-offset-2 hover:underline" style={{ color: '#8aa29a' }}>
                    Reset to default order
                  </button>
                </div>
              );
            })()}

            {/* ── Social Media tab ─────────────────────────────────────────── */}
            {tab === 'social' && (
              <div className="space-y-4">
                <div className={cardCls} style={cardStyle}>
                  <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">
                    <div className="flex h-7 w-7 items-center justify-center rounded-[7px]" style={{ background: 'var(--rp-teal-bg)' }}>
                      <Share2 className="h-3.5 w-3.5" style={{ color: '#23766a' }} />
                    </div>
                    Social Profiles
                  </h3>
                  <p className="text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">These links appear in your website footer. Leave blank to hide.</p>
                  {[
                    { key: 'facebookUrl',   label: 'Facebook',    placeholder: 'https://facebook.com/yourresort',   emoji: '📘' },
                    { key: 'instagramUrl',  label: 'Instagram',   placeholder: 'https://instagram.com/yourresort',  emoji: '📸' },
                    { key: 'twitterUrl',    label: 'X (Twitter)', placeholder: 'https://twitter.com/yourresort',    emoji: '🐦' },
                    { key: 'tiktokUrl',     label: 'TikTok',      placeholder: 'https://tiktok.com/@yourresort',    emoji: '🎵' },
                    { key: 'youtubeUrl',    label: 'YouTube',     placeholder: 'https://youtube.com/@yourresort',   emoji: '▶️' },
                    { key: 'tripadvisorUrl',label: 'TripAdvisor', placeholder: 'https://tripadvisor.com/hotel/...', emoji: '🦉' },
                  ].map(({ key, label, placeholder, emoji }) => (
                    <div key={key}>
                      <label className={labelCls}>{emoji} {label}</label>
                      <input
                        value={(form as unknown as Record<string, string>)[key] ?? ''}
                        onChange={e => set(key as keyof WebsiteContent, e.target.value)}
                        placeholder={placeholder} type="url" className={inputCls}
                      />
                    </div>
                  ))}
                </div>

                <div className={cardCls} style={cardStyle}>
                  <h3 className="text-[13.5px] font-semibold flex items-center gap-2 text-[#18231f] dark:text-[#dfd9d0]">
                    <span className="text-[16px]">💬</span> WhatsApp
                  </h3>
                  <p className="text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">A floating "Chat with us" button will appear on your public website.</p>
                  <div>
                    <label className={labelCls}>WhatsApp Number</label>
                    <input value={form.whatsappNumber ?? ''} onChange={e => set('whatsappNumber', e.target.value)}
                      placeholder="+8801XXXXXXXXX" className={inputCls} />
                    <p className="mt-1 text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">Include country code. E.g. +8801712345678</p>
                  </div>
                  {form.whatsappNumber && (
                    <div className="rounded-[10px] border p-4" style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)' }}>
                      <p className="text-[12px] font-medium mb-2" style={{ color: '#23766a' }}>Preview</p>
                      <a href={`https://wa.me/${form.whatsappNumber.replace(/\D/g, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 transition-colors"
                        style={{ background: '#25D366' }}>
                        💬 Chat with us on WhatsApp
                      </a>
                    </div>
                  )}
                  <div className="rounded-[10px] border p-3" style={{ background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.2)' }}>
                    <p className="text-[12px]" style={{ color: '#b89040' }}>
                      <strong>Tip:</strong> Social links and WhatsApp button are only shown to guests on your public website — not in the dashboard.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Custom Domain tab ────────────────────────────────────────── */}
            {tab === 'domain' && (
              <div className="space-y-4">

                {tenant?.slug && (
                  <div className="flex items-start gap-3 rounded-[12px] border p-4"
                    style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)' }}>
                    <Globe className="h-5 w-5 mt-0.5 shrink-0" style={{ color: '#23766a' }} />
                    <div>
                      <p className="text-[13px] font-semibold mb-0.5" style={{ color: '#1b342f' }}>Your free subdomain</p>
                      <a href={`https://${tenant.slug}.resortpro.site`} target="_blank" rel="noopener noreferrer"
                        className="text-[12.5px] font-mono flex items-center gap-1 hover:underline" style={{ color: '#23766a' }}>
                        {tenant.slug}.resortpro.site <ExternalLink className="h-3 w-3" />
                      </a>
                      <p className="mt-1 text-[11.5px] text-[#4a6e66] dark:text-[#6d9990]">This always works — no setup required.</p>
                    </div>
                  </div>
                )}

                <div className={cardCls} style={cardStyle}>
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-[7px]" style={{ background: 'var(--rp-surface-3)' }}>
                      <Link2 className="h-3.5 w-3.5 text-[#6b8880] dark:text-[#94b8b0]" />
                    </div>
                    <h3 className="text-[13.5px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">Connect a Custom Domain</h3>
                  </div>
                  <p className="text-[12.5px] text-[#8aa29a] dark:text-[#94b8b0]">
                    Use your own domain (e.g.{' '}
                    <code className="rounded-[5px] px-1 py-0.5 text-[11px] font-mono"
                      style={{ background: 'var(--rp-surface-3)', color: 'var(--rp-text-subtle)' }}>www.sunsetresort.com</code>
                    ) instead of the resortpro.site subdomain.
                  </p>

                  {domainInfo?.customDomain && (
                    <div className="flex items-center gap-3 rounded-[10px] border p-3"
                      style={domainInfo.domainVerified
                        ? { background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)' }
                        : { background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.25)' }}>
                      {domainInfo.domainVerified
                        ? <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: '#23766a' }} />
                        : <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: '#b89040' }} />}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold font-mono truncate text-[#18231f] dark:text-[#dfd9d0]">{domainInfo.customDomain}</p>
                        <p className="text-[11.5px]" style={{ color: domainInfo.domainVerified ? '#23766a' : '#b89040' }}>
                          {domainInfo.domainVerified ? 'Verified & live' : 'Pending DNS verification'}
                        </p>
                      </div>
                      {domainInfo.domainVerified && (
                        <a href={`https://${domainInfo.customDomain}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#23766a' }}>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  )}

                  <div>
                    <label className={labelCls}>Domain Name</label>
                    <div className="flex gap-2">
                      <input value={domainInput} onChange={e => setDomainInput(e.target.value.toLowerCase().trim())}
                        placeholder="www.yourresort.com" className={inputCls + ' font-mono'} />
                      <button
                        onClick={() => setDomainMut.mutate(domainInput || null)}
                        disabled={setDomainMut.isPending || (!domainInput && !domainInfo?.customDomain)}
                        className="flex shrink-0 items-center gap-1.5 rounded-[8px] px-4 py-2 text-[13px] font-medium disabled:opacity-60 hover:opacity-90"
                        style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                        {setDomainMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {domainInput ? 'Save' : 'Remove'}
                      </button>
                    </div>
                    <p className="mt-1 text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">Enter the exact domain with www or without — whichever you want to use.</p>
                  </div>

                  {domainInfo?.customDomain && !domainInfo.domainVerified && (
                    <button onClick={() => verifyMut.mutate()} disabled={verifyMut.isPending}
                      className="flex w-full items-center justify-center gap-2 rounded-[9px] border py-2 text-[13px] font-medium transition-colors disabled:opacity-60 hover:bg-[#f4ecda]"
                      style={{ borderColor: 'rgba(184,144,64,0.35)', color: '#b89040' }}>
                      {verifyMut.isPending
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking DNS…</>
                        : <><CheckCircle2 className="h-4 w-4" /> Verify Domain</>}
                    </button>
                  )}

                  {domainInfo?.customDomain && (
                    <button onClick={() => { setDomainInput(''); setDomainMut.mutate(null); }}
                      className="text-[12px] hover:underline" style={{ color: '#c43c3c' }}>
                      Remove custom domain
                    </button>
                  )}
                </div>

                {domainInfo?.customDomain && !domainInfo.domainVerified && (
                  <div className={cardCls} style={cardStyle}>
                    <h4 className="flex items-center gap-2 text-[13.5px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">
                      <FileText className="h-4 w-4 text-[#8aa29a] dark:text-[#94b8b0]" /> DNS Setup Instructions
                    </h4>
                    <p className="text-[12.5px] text-[#8aa29a] dark:text-[#94b8b0]">
                      Add <strong>one</strong> of these records in your DNS provider (Cloudflare, GoDaddy, Namecheap, etc.):
                    </p>
                    <div className="rounded-[10px] border p-4 space-y-3"
                      style={{ background: 'var(--rp-surface-2)', borderColor: 'var(--rp-border)' }}>
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8aa29a] dark:text-[#94b8b0]">Option 1 — CNAME (recommended)</p>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Type',          value: 'CNAME' },
                          { label: 'Name / Host',   value: domainInfo.customDomain.startsWith('www.') ? 'www' : '@' },
                          { label: 'Value / Target', value: domainInfo.cnameTarget ?? `${tenant?.slug}.resortpro.site` },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-[10.5px] mb-1 text-[#8aa29a] dark:text-[#94b8b0]">{label}</p>
                            <code className="block rounded-[6px] border px-2 py-1 text-[11px] font-mono break-all bg-white dark:bg-white/5" style={{ borderColor: 'var(--rp-border)', color: '#23766a' }}>{value}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">
                      DNS changes can take up to <strong>48 hours</strong> to propagate. Once set, click <strong>Verify Domain</strong> above.
                    </p>
                    <div className="rounded-[10px] border p-3" style={{ background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.2)' }}>
                      <p className="text-[12px]" style={{ color: '#b89040' }}>
                        <strong>Cloudflare users:</strong> Make sure the CNAME proxy is <strong>DNS only</strong> (grey cloud ☁️), not Proxied (orange cloud 🟠) during initial verification.
                      </p>
                    </div>
                  </div>
                )}

                {domainInfo?.domainVerified && (
                  <div className="flex items-start gap-3 rounded-[12px] border p-5"
                    style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)' }}>
                    <CheckCircle2 className="h-6 w-6 mt-0.5 shrink-0" style={{ color: '#23766a' }} />
                    <div>
                      <p className="text-[14px] font-semibold" style={{ color: '#1b342f' }}>Domain is live!</p>
                      <p className="text-[12.5px] mt-0.5 text-[#4a6e66] dark:text-[#6d9990]">
                        Your website is accessible at{' '}
                        <a href={`https://${domainInfo.customDomain}`} target="_blank" rel="noopener noreferrer"
                          className="font-semibold underline" style={{ color: '#23766a' }}>
                          {domainInfo.customDomain}
                        </a>
                      </p>
                      {domainInfo.domainVerifiedAt && (
                        <p className="text-[11.5px] mt-1 text-[#8aa29a] dark:text-[#94b8b0]">
                          Verified on {new Date(domainInfo.domainVerifiedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Save button at bottom of editor (all tabs except domain) */}
            {tab !== 'domain' && (
              <div className="flex justify-end pt-2 pb-4">
                <SaveBtn loading={saveMutation.isPending} dirty={dirty} onClick={() => setConfirmOpen(true)} />
              </div>
            )}

          </div>{/* end scrollable content */}
        </div>{/* end LEFT panel */}

        {/* ── RIGHT: Live preview ────────────────────────────────────────────── */}
        {showPreview && previewUrl && (
          <div className="hidden lg:flex flex-col min-h-0" style={{ background: '#e8e5e0' }}>

            {/* Preview toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'var(--rp-surface-2)' }}>
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#4a6e66] dark:text-[#6d9990]">
                <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: '#f59e0b' }} />
                Live Preview
              </span>
              <span className="rounded-full border px-2 py-0.5 text-[11px] font-mono"
                style={{ background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
                {form.templateId ?? 'luxe'}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => setMobileView(false)} title="Desktop view"
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] transition-colors"
                  style={!mobileView
                    ? { background: 'var(--rp-teal-bg)', color: '#23766a' }
                    : { color: 'var(--rp-text-faint)' }}>
                  <Monitor className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setMobileView(true)} title="Mobile view"
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] transition-colors"
                  style={mobileView
                    ? { background: 'var(--rp-teal-bg)', color: '#23766a' }
                    : { color: 'var(--rp-text-faint)' }}>
                  <Smartphone className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setPreviewKey(k => k + 1)} title="Reload preview"
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] ml-1 transition-colors hover:opacity-70 text-[#8aa29a] dark:text-[#94b8b0]">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" title="Open in new tab"
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] transition-colors hover:opacity-70 text-[#8aa29a] dark:text-[#94b8b0]">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* iframe wrapper */}
            <div className="flex-1 flex items-start justify-center overflow-auto p-5">
              <div className={`relative bg-white overflow-hidden transition-all duration-300 ${mobileView ? 'w-[390px] h-[844px] rounded-[24px] shadow-2xl' : 'w-full h-full rounded-[14px] shadow-xl'}`}>
                {mobileView && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 rounded-full mt-2 z-10"
                    style={{ background: 'var(--rp-text-faint)' }} />
                )}
                <iframe
                  key={`${previewKey}-${form.templateId}`}
                  ref={iframeRef}
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="Website preview"
                />
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Publish confirmation */}
      <ModalShell
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Publish your website?"
        description="Your changes will be live for guests immediately"
        footer={
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirmOpen(false)}
              className="rounded-[9px] border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-black/[0.03]"
              style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-muted)' }}>
              Keep editing
            </button>
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-60 hover:opacity-90"
              style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {saveMutation.isPending ? 'Publishing…' : 'Publish now'}
            </button>
          </div>
        }>
        <div className="space-y-3">
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--rp-text-muted)' }}>
            Guests will see the updated site at{' '}
            <span className="font-semibold" style={{ color: '#23766a' }}>{tenant?.slug}.resortpro.site</span>{' '}
            as soon as you publish.
          </p>
          {checklistPct < 100 && (
            <div className="flex items-start gap-2 rounded-[10px] border px-3 py-2.5"
              style={{ background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.25)' }}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#b89040' }} />
              <p className="text-[12.5px] leading-relaxed" style={{ color: '#8a6d30' }}>
                Your site is {checklistPct}% complete — you can publish now and finish the remaining{' '}
                {checklist.length - checklistDone} checklist item{checklist.length - checklistDone !== 1 ? 's' : ''} later.
              </p>
            </div>
          )}
        </div>
      </ModalShell>
    </div>
  );
}
