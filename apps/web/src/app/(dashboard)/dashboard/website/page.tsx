'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { websiteApi, tenantApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Globe, Image, FileText, Palette, Star, Plus, Trash2, Save, Layout, LayoutGrid, ExternalLink, Share2, Link2, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { ThemePicker } from '@/components/dashboard/website/ThemePicker';
import { ImageUpload } from '@/components/ui/ImageUpload';

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
  // Social media
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  tiktokUrl?: string;
  youtubeUrl?: string;
  whatsappNumber?: string;
  tripadvisorUrl?: string;
  hiddenSections?: string[];
}

const TOGGLEABLE_SECTIONS = [
  { id: 'about',        label: 'About / Our Story',  desc: 'Resort story, about image' },
  { id: 'amenities',    label: 'Amenities',           desc: 'Pool, spa, gym etc. (Coastal theme)' },
  { id: 'menu',         label: 'Restaurant Menu',     desc: 'Food menu with in-room ordering' },
  { id: 'gallery',      label: 'Photo Gallery',       desc: 'Image gallery grid' },
  { id: 'testimonials', label: 'Testimonials',        desc: 'Guest reviews & ratings' },
  { id: 'availability', label: 'Availability Calendar',desc: 'Date picker to check open rooms' },
  { id: 'contact',      label: 'Contact / Feedback',  desc: 'Contact form and map' },
] as const;

const TABS = [
  { id: 'template',    label: 'Template',    icon: Layout  },
  { id: 'hero',        label: 'Hero & About',icon: Globe   },
  { id: 'gallery',     label: 'Gallery',     icon: Image   },
  { id: 'testimonials',label: 'Testimonials',icon: Star    },
  { id: 'sections',    label: 'Sections',    icon: LayoutGrid },
  { id: 'seo',         label: 'SEO & Branding', icon: Palette },
  { id: 'social',      label: 'Social Media',icon: Share2  },
  { id: 'domain',      label: 'Custom Domain', icon: Link2 },
] as const;

type Tab = typeof TABS[number]['id'];

export default function WebsitePage() {
  const queryClient = useQueryClient();
  const { tenant } = useAuthStore();
  const [tab, setTab] = useState<Tab>('template');
  const [form, setForm] = useState<WebsiteContent>({
    heroTitle: '',
    heroSubtitle: '',
    heroImage: '',
    aboutTitle: '',
    aboutText: '',
    aboutImage: '',
    galleryImages: [],
    seoTitle: '',
    seoDescription: '',
    primaryColor: '#1a6b5e',
    accentColor: '#d4a853',
    testimonials: [],
    templateId: 'luxe',
    facebookUrl: '',
    instagramUrl: '',
    twitterUrl: '',
    tiktokUrl: '',
    youtubeUrl: '',
    whatsappNumber: '',
    tripadvisorUrl: '',
    hiddenSections: [],
  });

  const { data, isLoading } = useQuery({
    queryKey: ['website'],
    queryFn: () => websiteApi.get(),
  });

  useEffect(() => {
    const content = data?.data?.data;
    if (content) {
      setForm({
        heroTitle: content.heroTitle ?? '',
        heroSubtitle: content.heroSubtitle ?? '',
        heroImage: content.heroImage ?? '',
        aboutTitle: content.aboutTitle ?? '',
        aboutText: content.aboutText ?? '',
        aboutImage: content.aboutImage ?? '',
        galleryImages: content.galleryImages ?? [],
        seoTitle: content.seoTitle ?? '',
        seoDescription: content.seoDescription ?? '',
        primaryColor: content.primaryColor ?? '#1a6b5e',
        accentColor: content.accentColor ?? '#d4a853',
        testimonials: content.testimonials ?? [],
        templateId: content.templateId ?? 'luxe',
        facebookUrl: content.facebookUrl ?? '',
        instagramUrl: content.instagramUrl ?? '',
        twitterUrl: content.twitterUrl ?? '',
        tiktokUrl: content.tiktokUrl ?? '',
        youtubeUrl: content.youtubeUrl ?? '',
        whatsappNumber: content.whatsappNumber ?? '',
        tripadvisorUrl: content.tripadvisorUrl ?? '',
        hiddenSections: content.hiddenSections ?? [],
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => websiteApi.update(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website'] });
      toast({ title: 'Website updated!', description: 'Your changes are live.' });
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to save', variant: 'destructive' }),
  });

  const set = (k: keyof WebsiteContent, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const addGalleryImage = () => set('galleryImages', [...(form.galleryImages ?? []), '']);
  const setGalleryImage = (i: number, url: string) =>
    set('galleryImages', (form.galleryImages ?? []).map((img, idx) => idx === i ? url : img));
  const removeGalleryImage = (i: number) =>
    set('galleryImages', (form.galleryImages ?? []).filter((_, idx) => idx !== i));

  const addTestimonial = () => set('testimonials', [...(form.testimonials ?? []), { name: '', text: '', rating: 5 }]);
  const setTestimonial = (i: number, key: string, value: unknown) =>
    set('testimonials', (form.testimonials ?? []).map((t, idx) => idx === i ? { ...t, [key]: value } : t));
  const removeTestimonial = (i: number) =>
    set('testimonials', (form.testimonials ?? []).filter((_, idx) => idx !== i));

  const publicUrl = tenant?.slug ? `/${tenant.slug}` : null;

  /* ── Custom domain state ─────────────────────────────────────────────────── */
  const [domainInput, setDomainInput] = useState('');
  const [domainInfo,  setDomainInfo]  = useState<{
    customDomain: string | null;
    domainVerified: boolean;
    domainVerifiedAt: string | null;
    cnameTarget?: string;
    aRecord?: string | null;
  } | null>(null);

  const { data: tenantData } = useQuery({
    queryKey: ['tenant-domain'],
    queryFn:  () => tenantApi.get(),
  });

  useEffect(() => {
    const t = tenantData?.data?.data;
    if (t) {
      setDomainInfo({
        customDomain:    t.customDomain ?? null,
        domainVerified:  t.domainVerified ?? false,
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
      <div className="space-y-6">
        <div className="h-8 w-48 rounded bg-gray-200 animate-pulse" />
        <div className="h-64 rounded-xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Website</h1>
          <p className="mt-1 text-sm text-muted-foreground">Design and publish your public resort website</p>
        </div>
        <div className="flex gap-2">
          {publicUrl && (
            <Button variant="outline" className="gap-2" onClick={() => window.open(publicUrl, '_blank')}>
              <ExternalLink className="h-4 w-4" /> View Live Site
            </Button>
          )}
          <Button className="gap-2" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            <Save className="h-4 w-4" /> Save & Publish
          </Button>
        </div>
      </div>

      {/* Live URL banner */}
      {publicUrl && (
        <div className="flex items-center gap-3 rounded-xl border border-resort-200 bg-resort-50 px-5 py-3">
          <Globe className="h-4 w-4 text-resort-600 flex-shrink-0" />
          <p className="text-sm text-resort-700">
            Your website is live at{' '}
            <a href={publicUrl} target="_blank" rel="noopener noreferrer"
              className="font-semibold underline hover:text-resort-900">
              {typeof window !== 'undefined' ? window.location.origin : ''}{publicUrl}
            </a>
          </p>
          <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-green-600">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" /> Live
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === id ? 'border-resort-600 text-resort-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── Theme Picker ────────────────────────────────────────────────── */}
      {tab === 'template' && tenant?.slug && (
        <ThemePicker
          currentTheme={form.templateId ?? 'luxe'}
          slug={tenant.slug}
          onSelect={(key) => set('templateId', key)}
        />
      )}

      {/* ── Hero & About ─────────────────────────────────────────────────── */}
      {tab === 'hero' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Globe className="h-4 w-4 text-resort-600" /> Hero Section</h3>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Hero Title *</label>
                <Input value={form.heroTitle} onChange={e => set('heroTitle', e.target.value)} placeholder="Welcome to Paradise" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Hero Subtitle</label>
                <Input value={form.heroSubtitle ?? ''} onChange={e => set('heroSubtitle', e.target.value)} placeholder="Experience luxury at its finest" />
              </div>
              <div>
                <ImageUpload
                  value={form.heroImage ?? null}
                  onChange={url => set('heroImage', url ?? '')}
                  folder="website"
                  label="Hero Background Image"
                  hint="Recommended: 1920×1080px landscape photo"
                  aspectRatio="wide"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><FileText className="h-4 w-4 text-resort-600" /> About Section</h3>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">About Title</label>
                <Input value={form.aboutTitle ?? ''} onChange={e => set('aboutTitle', e.target.value)} placeholder="Our Story" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">About Text</label>
                <textarea value={form.aboutText ?? ''} onChange={e => set('aboutText', e.target.value)} rows={4}
                  placeholder="Tell guests about your property..."
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
              </div>
              <div>
                <ImageUpload
                  value={form.aboutImage ?? null}
                  onChange={url => set('aboutImage', url ?? '')}
                  folder="website"
                  label="About Section Image"
                  hint="Recommended: square or portrait photo"
                  aspectRatio="video"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Gallery ──────────────────────────────────────────────────────── */}
      {tab === 'gallery' && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Image className="h-4 w-4 text-resort-600" /> Gallery Images</h3>
              <span className="text-xs text-gray-400">{(form.galleryImages ?? []).length} photos</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(form.galleryImages ?? []).map((url, i) => (
                <div key={i} className="group relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Gallery ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    onClick={() => removeGalleryImage(i)}
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
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
          </CardContent>
        </Card>
      )}

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      {tab === 'testimonials' && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Star className="h-4 w-4 text-resort-600" /> Guest Testimonials</h3>
              <Button size="sm" variant="outline" onClick={addTestimonial} className="gap-1"><Plus className="h-3.5 w-3.5" /> Add Testimonial</Button>
            </div>
            {(form.testimonials ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                <Star className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm text-muted-foreground">No testimonials yet</p>
                <Button size="sm" className="mt-3 gap-1" onClick={addTestimonial}><Plus className="h-3.5 w-3.5" /> Add First Testimonial</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {(form.testimonials ?? []).map((t, i) => (
                  <div key={i} className="rounded-xl border border-gray-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Testimonial #{i + 1}</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => removeTestimonial(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Guest Name</label>
                        <Input value={t.name} onChange={e => setTestimonial(i, 'name', e.target.value)} placeholder="John Smith" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Rating</label>
                        <select value={t.rating} onChange={e => setTestimonial(i, 'rating', parseInt(e.target.value))}
                          className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                          {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{'★'.repeat(r)} ({r}/5)</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Review Text</label>
                      <textarea value={t.text} onChange={e => setTestimonial(i, 'text', e.target.value)} rows={2}
                        placeholder="What did they say about the stay?"
                        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── SEO & Branding ───────────────────────────────────────────────── */}
      {tab === 'seo' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><FileText className="h-4 w-4 text-resort-600" /> SEO Settings</h3>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">SEO Title</label>
                <Input value={form.seoTitle ?? ''} onChange={e => set('seoTitle', e.target.value)} placeholder="Palm Paradise Resort — Luxury Stays" />
                <p className="mt-1 text-xs text-muted-foreground">{(form.seoTitle ?? '').length}/60 characters recommended</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Meta Description</label>
                <textarea value={form.seoDescription ?? ''} onChange={e => set('seoDescription', e.target.value)} rows={3}
                  placeholder="Experience luxury like never before..."
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
                <p className="mt-1 text-xs text-muted-foreground">{(form.seoDescription ?? '').length}/160 characters recommended</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Palette className="h-4 w-4 text-resort-600" /> Brand Colors</h3>
              <p className="text-xs text-muted-foreground">These colors apply to your selected template.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Primary Color</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.primaryColor ?? '#1a6b5e'} onChange={e => set('primaryColor', e.target.value)}
                      className="h-9 w-12 rounded border border-input cursor-pointer" />
                    <Input value={form.primaryColor ?? ''} onChange={e => set('primaryColor', e.target.value)} placeholder="#1a6b5e" className="font-mono text-sm" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Accent Color</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.accentColor ?? '#d4a853'} onChange={e => set('accentColor', e.target.value)}
                      className="h-9 w-12 rounded border border-input cursor-pointer" />
                    <Input value={form.accentColor ?? ''} onChange={e => set('accentColor', e.target.value)} placeholder="#d4a853" className="font-mono text-sm" />
                  </div>
                </div>
              </div>
              <div className="rounded-xl overflow-hidden border mt-2">
                <div className="p-4 text-white text-sm font-semibold" style={{ backgroundColor: form.primaryColor ?? '#1a6b5e' }}>
                  Primary — Hero, Nav & Buttons
                </div>
                <div className="p-4 text-sm font-semibold" style={{ backgroundColor: form.accentColor ?? '#d4a853' }}>
                  Accent — CTAs & Highlights
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Sections Visibility ──────────────────────────────────────────── */}
      {tab === 'sections' && (
        <div className="max-w-2xl space-y-4">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
              <LayoutGrid className="h-4 w-4 text-resort-600" /> Section Visibility
            </h3>
            <p className="text-xs text-gray-500 mb-6">
              যে sections hide করবেন সেগুলো আপনার resort website-এ দেখাবে না।
            </p>
            <div className="space-y-3">
              {TOGGLEABLE_SECTIONS.map(sec => {
                const isHidden = (form.hiddenSections ?? []).includes(sec.id);
                const toggle = () => set('hiddenSections',
                  isHidden
                    ? (form.hiddenSections ?? []).filter(s => s !== sec.id)
                    : [...(form.hiddenSections ?? []), sec.id]
                );
                return (
                  <div key={sec.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-colors cursor-pointer ${
                      isHidden
                        ? 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 opacity-60'
                        : 'border-resort-200 dark:border-resort-800/40 bg-resort-50/50 dark:bg-resort-900/10'
                    }`}
                    onClick={toggle}>
                    <div>
                      <p className={`text-sm font-medium ${isHidden ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                        {sec.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{sec.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); toggle(); }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        isHidden ? 'bg-gray-300 dark:bg-gray-700' : 'bg-resort-600'
                      }`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        isHidden ? 'translate-x-1' : 'translate-x-6'
                      }`} />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
              <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-2" /> Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Social Media ─────────────────────────────────────────────────── */}
      {tab === 'social' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Share2 className="h-4 w-4 text-resort-600" /> Social Profiles
              </h3>
              <p className="text-xs text-muted-foreground">These links appear in your website footer. Leave blank to hide.</p>

              {[
                { key: 'facebookUrl', label: 'Facebook', placeholder: 'https://facebook.com/yourresort', emoji: '📘' },
                { key: 'instagramUrl', label: 'Instagram', placeholder: 'https://instagram.com/yourresort', emoji: '📸' },
                { key: 'twitterUrl', label: 'X (Twitter)', placeholder: 'https://twitter.com/yourresort', emoji: '🐦' },
                { key: 'tiktokUrl', label: 'TikTok', placeholder: 'https://tiktok.com/@yourresort', emoji: '🎵' },
                { key: 'youtubeUrl', label: 'YouTube', placeholder: 'https://youtube.com/@yourresort', emoji: '▶️' },
                { key: 'tripadvisorUrl', label: 'TripAdvisor', placeholder: 'https://tripadvisor.com/hotel/...', emoji: '🦉' },
              ].map(({ key, label, placeholder, emoji }) => (
                <div key={key}>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{emoji} {label}</label>
                  <Input
                    value={(form as unknown as Record<string, string>)[key] ?? ''}
                    onChange={e => set(key as keyof WebsiteContent, e.target.value)}
                    placeholder={placeholder}
                    type="url"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <span className="text-lg">💬</span> WhatsApp
              </h3>
              <p className="text-xs text-muted-foreground">
                A floating "Chat with us" button will appear on your public website.
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">WhatsApp Number</label>
                <Input
                  value={form.whatsappNumber ?? ''}
                  onChange={e => set('whatsappNumber', e.target.value)}
                  placeholder="+8801XXXXXXXXX"
                />
                <p className="mt-1 text-xs text-muted-foreground">Include country code. E.g. +8801712345678</p>
              </div>

              {form.whatsappNumber && (
                <div className="rounded-xl bg-green-50 border border-green-100 p-4">
                  <p className="text-sm text-green-700 font-medium mb-1">Preview</p>
                  <a
                    href={`https://wa.me/${form.whatsappNumber.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-green-600 transition-colors"
                  >
                    <span>💬</span> Chat with us on WhatsApp
                  </a>
                </div>
              )}

              <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 mt-4">
                <p className="text-xs text-blue-700">
                  <span className="font-semibold">Tip:</span> Social links and WhatsApp button are only shown to guests on your public website — not in the dashboard.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Custom Domain ──────────────────────────────────────────────────── */}
      {tab === 'domain' && (
        <div className="max-w-2xl space-y-6">

          {/* Subdomain info banner */}
          {tenant?.slug && (
            <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <Globe className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-800 mb-0.5">Your free subdomain</p>
                <a href={`https://${tenant.slug}.resortpro.site`} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-mono text-blue-700 hover:underline flex items-center gap-1">
                  {tenant.slug}.resortpro.site <ExternalLink className="h-3 w-3" />
                </a>
                <p className="mt-1 text-xs text-blue-600">This always works — no setup required.</p>
              </div>
            </div>
          )}

          {/* Custom domain card */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-resort-600" />
                <h3 className="font-semibold text-gray-900">Connect a Custom Domain</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Use your own domain (e.g. <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-xs">www.sunsetresort.com</span>) instead of the resortpro.site subdomain.
              </p>

              {/* Current status */}
              {domainInfo?.customDomain && (
                <div className={`flex items-center gap-3 rounded-xl border p-3 ${
                  domainInfo.domainVerified
                    ? 'bg-green-50 border-green-200'
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  {domainInfo.domainVerified
                    ? <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    : <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 font-mono truncate">{domainInfo.customDomain}</p>
                    <p className={`text-xs ${domainInfo.domainVerified ? 'text-green-600' : 'text-amber-600'}`}>
                      {domainInfo.domainVerified ? `Verified & live` : 'Pending DNS verification'}
                    </p>
                  </div>
                  {domainInfo.domainVerified && (
                    <a href={`https://${domainInfo.customDomain}`} target="_blank" rel="noopener noreferrer"
                      className="text-green-600 hover:text-green-800">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )}

              {/* Input */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Domain Name</label>
                <div className="flex gap-2">
                  <Input
                    value={domainInput}
                    onChange={e => setDomainInput(e.target.value.toLowerCase().trim())}
                    placeholder="www.yourresort.com"
                    className="font-mono"
                  />
                  <Button
                    onClick={() => setDomainMut.mutate(domainInput || null)}
                    loading={setDomainMut.isPending}
                    disabled={!domainInput && !domainInfo?.customDomain}
                    variant={domainInput ? 'default' : 'outline'}>
                    {domainInput ? 'Save' : 'Remove'}
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Enter the exact domain with www or without — whichever you want to use.</p>
              </div>

              {/* Verify button */}
              {domainInfo?.customDomain && !domainInfo.domainVerified && (
                <Button
                  variant="outline"
                  className="w-full gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => verifyMut.mutate()}
                  loading={verifyMut.isPending}>
                  {verifyMut.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking DNS…</>
                    : <><CheckCircle2 className="h-4 w-4" /> Verify Domain</>
                  }
                </Button>
              )}

              {/* Remove domain */}
              {domainInfo?.customDomain && (
                <button
                  onClick={() => { setDomainInput(''); setDomainMut.mutate(null); }}
                  className="text-xs text-red-500 hover:text-red-700 hover:underline">
                  Remove custom domain
                </button>
              )}
            </CardContent>
          </Card>

          {/* DNS setup instructions */}
          {domainInfo?.customDomain && !domainInfo.domainVerified && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-resort-600" /> DNS Setup Instructions
                </h4>
                <p className="text-sm text-muted-foreground">
                  Add <strong>one</strong> of these records in your DNS provider (Cloudflare, GoDaddy, Namecheap, etc.):
                </p>

                {/* CNAME option */}
                <div className="rounded-xl bg-gray-50 border p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Option 1 — CNAME (recommended)</p>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Type</p>
                      <code className="font-mono bg-white border rounded px-2 py-1 text-xs">CNAME</code>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Name / Host</p>
                      <code className="font-mono bg-white border rounded px-2 py-1 text-xs">
                        {domainInfo.customDomain.startsWith('www.') ? 'www' : '@'}
                      </code>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Value / Target</p>
                      <code className="font-mono bg-white border rounded px-2 py-1 text-xs break-all">
                        {domainInfo.cnameTarget ?? `${tenant?.slug}.resortpro.site`}
                      </code>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  DNS changes can take up to <strong>48 hours</strong> to propagate. Once set, click <strong>Verify Domain</strong> above.
                </p>

                {/* Cloudflare specific tip */}
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs text-amber-700">
                    <strong>Cloudflare users:</strong> Make sure the CNAME proxy is <strong>DNS only</strong> (grey cloud ☁️), not Proxied (orange cloud 🟠) during initial verification. You can re-enable proxying after verification.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Verified success state */}
          {domainInfo?.domainVerified && (
            <div className="rounded-xl bg-green-50 border border-green-200 p-5 flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-800">Domain is live!</p>
                <p className="text-sm text-green-700 mt-0.5">
                  Your website is accessible at{' '}
                  <a href={`https://${domainInfo.customDomain}`} target="_blank" rel="noopener noreferrer"
                    className="font-semibold underline">
                    {domainInfo.customDomain}
                  </a>
                </p>
                {domainInfo.domainVerifiedAt && (
                  <p className="text-xs text-green-600 mt-1">
                    Verified on {new Date(domainInfo.domainVerifiedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save (bottom) — hide on domain tab, it has its own save */}
      {tab !== 'domain' && (
        <div className="flex justify-end pt-2">
          <Button className="gap-2 px-8" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            <Save className="h-4 w-4" /> Save & Publish
          </Button>
        </div>
      )}
    </div>
  );
}
