'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth';
import {
  Building2, Globe, Phone, Mail, MapPin, Clock, DollarSign, Save, Info,
} from 'lucide-react';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'INR', 'THB', 'IDR'];
const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore',
  'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland',
];

interface TenantSettings {
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  timezone: string;
  currency: string;
  website?: string;
  checkInTime?: string;
  checkOutTime?: string;
}

const TABS = [
  { id: 'general', label: 'General', icon: Building2 },
  { id: 'contact', label: 'Contact', icon: Phone },
  { id: 'operations', label: 'Operations', icon: Clock },
] as const;

type Tab = typeof TABS[number]['id'];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { tenant } = useAuthStore();
  const [tab, setTab] = useState<Tab>('general');
  const [form, setForm] = useState<TenantSettings>({
    name: '',
    slug: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    timezone: 'America/New_York',
    currency: 'USD',
    website: '',
    checkInTime: '14:00',
    checkOutTime: '11:00',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['tenant'],
    queryFn: () => tenantApi.get(),
  });

  useEffect(() => {
    const t = data?.data?.data;
    if (t) {
      setForm({
        name: t.name ?? '',
        slug: t.slug ?? '',
        email: t.email ?? '',
        phone: t.phone ?? '',
        address: t.address ?? '',
        city: t.city ?? '',
        country: t.country ?? '',
        timezone: t.timezone ?? 'America/New_York',
        currency: t.currency ?? 'USD',
        website: t.website ?? '',
        checkInTime: t.checkInTime ?? '14:00',
        checkOutTime: t.checkOutTime ?? '11:00',
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => tenantApi.update(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      toast({ title: 'Settings saved!' });
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to save', variant: 'destructive' }),
  });

  const set = (k: keyof TenantSettings, v: string) => setForm(f => ({ ...f, [k]: v }));

  if (isLoading) {
    return <div className="h-64 rounded-xl bg-gray-100 animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your resort configuration</p>
        </div>
        <Button className="gap-2" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          <Save className="h-4 w-4" /> Save Changes
        </Button>
      </div>

      {/* Tenant Info Banner */}
      {tenant && (
        <div className="flex items-center gap-3 rounded-xl border border-resort-200 bg-resort-50 px-5 py-3">
          <Info className="h-4 w-4 text-resort-600 flex-shrink-0" />
          <p className="text-sm text-resort-700">
            You are managing <strong>{tenant.name}</strong> — slug: <code className="font-mono bg-resort-100 px-1 rounded">{tenant.slug}</code>
          </p>
        </div>
      )}

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

      {/* General */}
      {tab === 'general' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Building2 className="h-4 w-4 text-resort-600" /> Resort Identity</h3>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Resort Name *</label>
                <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Palm Paradise Resort" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">URL Slug</label>
                <div className="flex rounded-lg border border-input overflow-hidden">
                  <span className="flex items-center px-3 bg-gray-50 text-sm text-muted-foreground border-r">resortpro.com/</span>
                  <Input value={form.slug} onChange={e => set('slug', e.target.value)} className="rounded-none border-0 flex-1 focus:ring-0" placeholder="palm-paradise" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Used for your public URL and guest portal</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Website URL</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={form.website ?? ''} onChange={e => set('website', e.target.value)} className="pl-9" placeholder="https://palmparadise.com" type="url" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><MapPin className="h-4 w-4 text-resort-600" /> Location</h3>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
                <Input value={form.address ?? ''} onChange={e => set('address', e.target.value)} placeholder="123 Beach Road" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">City</label>
                  <Input value={form.city ?? ''} onChange={e => set('city', e.target.value)} placeholder="Kuta" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Country</label>
                  <Input value={form.country ?? ''} onChange={e => set('country', e.target.value)} placeholder="Indonesia" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Contact */}
      {tab === 'contact' && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Phone className="h-4 w-4 text-resort-600" /> Contact Details</h3>
            <div className="grid grid-cols-2 gap-4 max-w-2xl">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={form.email ?? ''} onChange={e => set('email', e.target.value)} className="pl-9" placeholder="hello@resort.com" type="email" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} className="pl-9" placeholder="+62 361 000 0000" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operations */}
      {tab === 'operations' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Clock className="h-4 w-4 text-resort-600" /> Check-In / Check-Out Times</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Check-In Time</label>
                  <Input value={form.checkInTime ?? '14:00'} onChange={e => set('checkInTime', e.target.value)} type="time" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Check-Out Time</label>
                  <Input value={form.checkOutTime ?? '11:00'} onChange={e => set('checkOutTime', e.target.value)} type="time" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">These times are shown to guests and used for booking calculations</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><DollarSign className="h-4 w-4 text-resort-600" /> Locale & Currency</h3>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Currency</label>
                <select value={form.currency} onChange={e => set('currency', e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Timezone</label>
                <select value={form.timezone} onChange={e => set('timezone', e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('/', ' / ').replace('_', ' ')}</option>)}
                </select>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button className="gap-2 px-8" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          <Save className="h-4 w-4" /> Save All Changes
        </Button>
      </div>
    </div>
  );
}
