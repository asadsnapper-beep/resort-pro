'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi, api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth';
import {
  Building2, Globe, Phone, Mail, MapPin, Clock, DollarSign, Save, Info,
  ExternalLink, CheckCircle, XCircle, AlertTriangle, Copy, RefreshCw, Trash2,
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
  { id: 'general',    label: 'General',       icon: Building2 },
  { id: 'contact',    label: 'Contact',        icon: Phone },
  { id: 'operations', label: 'Operations',     icon: Clock },
  { id: 'domain',     label: 'Custom Domain',  icon: Globe },
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

  // ── Custom domain state ──────────────────────────────────────────────────
  const { token } = useAuthStore();
  const tenantData = data?.data?.data;
  const [domainInput, setDomainInput]   = useState('');
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainVerifying, setDomainVerifying] = useState(false);
  const [domainStatus, setDomainStatus] = useState<{
    customDomain: string | null;
    domainVerified: boolean;
    cnameTarget?: string;
    instructions?: string[];
  } | null>(null);

  useEffect(() => {
    if (tenantData?.customDomain !== undefined) {
      setDomainInput(tenantData.customDomain ?? '');
      setDomainStatus({
        customDomain:   tenantData.customDomain,
        domainVerified: tenantData.domainVerified ?? false,
      });
    }
  }, [tenantData]);

  const saveDomain = async () => {
    setDomainSaving(true);
    try {
      const res = await api.put('/tenant/domain',
        { domain: domainInput || null },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const d = res.data.data;
      setDomainStatus({ customDomain: d.customDomain, domainVerified: false, cnameTarget: d.cnameTarget, instructions: d.instructions });
      toast({ title: domainInput ? 'Domain saved! Set your DNS now.' : 'Domain removed' });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.response?.data?.error ?? 'Failed to save domain', variant: 'destructive' });
    }
    setDomainSaving(false);
  };

  const verifyDomain = async () => {
    setDomainVerifying(true);
    try {
      const res = await api.post('/tenant/domain/verify', {}, { headers: { Authorization: `Bearer ${token}` } });
      setDomainStatus(s => s ? { ...s, domainVerified: true } : s);
      toast({ title: res.data.message ?? '✅ Domain verified!' });
    } catch (e: any) {
      toast({ title: 'Verification failed', description: e?.response?.data?.message ?? 'DNS not configured yet', variant: 'destructive' });
    }
    setDomainVerifying(false);
  };

  const removeDomain = async () => {
    if (!confirm('Remove custom domain?')) return;
    setDomainSaving(true);
    try {
      await api.put('/tenant/domain', { domain: null }, { headers: { Authorization: `Bearer ${token}` } });
      setDomainInput('');
      setDomainStatus({ customDomain: null, domainVerified: false });
      toast({ title: 'Custom domain removed' });
    } catch { /* ignore */ }
    setDomainSaving(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!' });
  };

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

      {/* Custom Domain */}
      {tab === 'domain' && (
        <div className="space-y-5 max-w-2xl">

          {/* Status banner */}
          {domainStatus?.customDomain && (
            <div className={`flex items-center gap-3 rounded-xl border px-5 py-3 ${
              domainStatus.domainVerified
                ? 'border-green-200 bg-green-50'
                : 'border-yellow-200 bg-yellow-50'
            }`}>
              {domainStatus.domainVerified
                ? <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                : <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />}
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: domainStatus.domainVerified ? '#16a34a' : '#92400e' }}>
                  {domainStatus.domainVerified ? `✅ ${domainStatus.customDomain} is live!` : `⏳ ${domainStatus.customDomain} — awaiting DNS`}
                </p>
                <p className="text-xs mt-0.5" style={{ color: domainStatus.domainVerified ? '#15803d' : '#78350f' }}>
                  {domainStatus.domainVerified
                    ? 'Guests can access your website at this domain'
                    : 'Configure DNS below, then click Verify Domain'}
                </p>
              </div>
              {domainStatus.domainVerified && (
                <a href={`https://${domainStatus.customDomain}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-medium text-green-700 hover:underline">
                  Visit <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {/* Domain input card */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-1">
                  <Globe className="h-4 w-4 text-resort-600" /> Custom Domain
                </h3>
                <p className="text-sm text-gray-500">
                  Connect your own domain (e.g. <code className="bg-gray-100 px-1 rounded text-xs">www.sunsetresort.com</code>) to your resort website.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Domain</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      value={domainInput}
                      onChange={e => setDomainInput(e.target.value.toLowerCase().trim())}
                      className="pl-9"
                      placeholder="www.yourresort.com"
                    />
                  </div>
                  <Button onClick={saveDomain} loading={domainSaving} disabled={domainSaving}>
                    Save
                  </Button>
                  {domainStatus?.customDomain && (
                    <button onClick={removeDomain}
                      className="px-3 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Remove domain">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Enter without https:// — e.g. <code>www.sunsetresort.com</code></p>
              </div>

              {/* Verify button */}
              {domainStatus?.customDomain && !domainStatus.domainVerified && (
                <Button variant="outline" onClick={verifyDomain} loading={domainVerifying}
                  className="gap-2 w-full border-resort-200 text-resort-700 hover:bg-resort-50">
                  <RefreshCw className="h-4 w-4" /> Verify Domain
                </Button>
              )}
            </CardContent>
          </Card>

          {/* DNS instructions */}
          {domainStatus?.customDomain && (
            <Card>
              <CardContent className="p-6 space-y-5">
                <h3 className="font-semibold text-gray-900">DNS Configuration</h3>
                <p className="text-sm text-gray-500">
                  Add one of the following records in your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.):
                </p>

                {/* CNAME Option */}
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Option 1 — CNAME record (recommended)</p>
                    <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">Recommended</span>
                  </div>
                  <div className="p-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-400 border-b border-gray-100">
                          <th className="text-left pb-2 font-medium">Type</th>
                          <th className="text-left pb-2 font-medium">Name / Host</th>
                          <th className="text-left pb-2 font-medium">Value / Target</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="py-2 pr-4"><span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">CNAME</span></td>
                          <td className="py-2 pr-4 font-mono text-xs text-gray-700">
                            {domainStatus.customDomain?.replace(/\.(com|net|org|io|app|co\.\w+)$/, '') ?? 'www'}
                          </td>
                          <td className="py-2 font-mono text-xs text-gray-700">
                            {domainStatus.cnameTarget ?? `${tenantData?.slug}.resortpro.app`}
                          </td>
                          <td className="py-2">
                            <button onClick={() => copyToClipboard(domainStatus.cnameTarget ?? '')}
                              className="text-gray-400 hover:text-gray-600 transition-colors">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Step-by-step */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Step-by-step:</p>
                  {[
                    { n: 1, text: 'Log in to your domain registrar (GoDaddy, Namecheap, Cloudflare…)' },
                    { n: 2, text: 'Go to DNS Management / DNS Records' },
                    { n: 3, text: `Add a CNAME record pointing to: ${domainStatus.cnameTarget ?? `${tenantData?.slug}.resortpro.app`}` },
                    { n: 4, text: 'Save changes — DNS propagation takes 15 min to 48 hours' },
                    { n: 5, text: 'Come back here and click "Verify Domain"' },
                  ].map(({ n, text }) => (
                    <div key={n} className="flex items-start gap-3">
                      <span className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: '#1a6b5e' }}>{n}</span>
                      <p className="text-sm text-gray-600">{text}</p>
                    </div>
                  ))}
                </div>

                {/* Propagation note */}
                <div className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                  <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    DNS changes can take <strong>15 minutes to 48 hours</strong> to propagate worldwide.
                    If verification fails, wait a bit and try again.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* How it works */}
          {!domainStatus?.customDomain && (
            <Card className="border-dashed">
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-700 mb-4">How Custom Domains Work</h3>
                <div className="space-y-3">
                  {[
                    { icon: '1️⃣', text: 'Enter your domain above and click Save' },
                    { icon: '2️⃣', text: 'Add a CNAME DNS record at your registrar pointing to ResortPro' },
                    { icon: '3️⃣', text: 'Click "Verify Domain" — we check your DNS automatically' },
                    { icon: '4️⃣', text: 'Your guests visit your custom domain and see your resort website' },
                  ].map(({ icon, text }) => (
                    <div key={icon} className="flex items-center gap-3 text-sm text-gray-600">
                      <span className="text-lg">{icon}</span>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab !== 'domain' && (
        <div className="flex justify-end pt-2">
          <Button className="gap-2 px-8" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            <Save className="h-4 w-4" /> Save All Changes
          </Button>
        </div>
      )}
    </div>
  );
}
