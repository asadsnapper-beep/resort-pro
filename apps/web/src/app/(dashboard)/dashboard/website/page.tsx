'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { websiteApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Globe, Image, FileText, Palette, Star, Plus, Trash2, Save, Eye } from 'lucide-react';

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
}

const TABS = [
  { id: 'hero', label: 'Hero & About', icon: Globe },
  { id: 'gallery', label: 'Gallery', icon: Image },
  { id: 'testimonials', label: 'Testimonials', icon: Star },
  { id: 'seo', label: 'SEO & Branding', icon: Palette },
] as const;

type Tab = typeof TABS[number]['id'];

export default function WebsitePage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('hero');
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
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => websiteApi.update(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['website'] }); toast({ title: 'Website updated!' }); },
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Website Content</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your public-facing resort website</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => window.open('/', '_blank')}>
            <Eye className="h-4 w-4" /> Preview
          </Button>
          <Button className="gap-2" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id ? 'border-resort-600 text-resort-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* Hero & About */}
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
                <label className="mb-1 block text-sm font-medium text-gray-700">Hero Background Image URL</label>
                <Input value={form.heroImage ?? ''} onChange={e => set('heroImage', e.target.value)} placeholder="https://..." type="url" />
                {form.heroImage && (
                  <div className="mt-2 rounded-lg overflow-hidden h-32">
                    <img src={form.heroImage} alt="Hero preview" className="w-full h-full object-cover" />
                  </div>
                )}
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
                <label className="mb-1 block text-sm font-medium text-gray-700">About Image URL</label>
                <Input value={form.aboutImage ?? ''} onChange={e => set('aboutImage', e.target.value)} placeholder="https://..." type="url" />
                {form.aboutImage && (
                  <div className="mt-2 rounded-lg overflow-hidden h-24">
                    <img src={form.aboutImage} alt="About preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gallery */}
      {tab === 'gallery' && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Image className="h-4 w-4 text-resort-600" /> Gallery Images</h3>
              <Button size="sm" variant="outline" onClick={addGalleryImage} className="gap-1"><Plus className="h-3.5 w-3.5" /> Add Image</Button>
            </div>
            {(form.galleryImages ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                <Image className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm text-muted-foreground">No gallery images yet</p>
                <Button size="sm" className="mt-3 gap-1" onClick={addGalleryImage}><Plus className="h-3.5 w-3.5" /> Add First Image</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(form.galleryImages ?? []).map((url, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex gap-2">
                      <Input value={url} onChange={e => setGalleryImage(i, e.target.value)} placeholder="https://..." type="url" className="flex-1" />
                      <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeGalleryImage(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {url && (
                      <div className="rounded-lg overflow-hidden h-32">
                        <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Testimonials */}
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

      {/* SEO & Branding */}
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

              {/* Color Preview */}
              <div className="rounded-xl overflow-hidden border mt-2">
                <div className="p-4 text-white text-sm font-semibold" style={{ backgroundColor: form.primaryColor ?? '#1a6b5e' }}>
                  Primary Color — Hero & Navigation
                </div>
                <div className="p-4 text-sm font-semibold" style={{ backgroundColor: form.accentColor ?? '#d4a853' }}>
                  Accent Color — Buttons & Highlights
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Save Button (bottom) */}
      <div className="flex justify-end pt-2">
        <Button className="gap-2 px-8" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          <Save className="h-4 w-4" /> Save All Changes
        </Button>
      </div>
    </div>
  );
}
