'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi, api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth';
import {
  Building2, Globe, Phone, Mail, MapPin, Clock, Banknote, Save, Info,
  ExternalLink, CheckCircle, XCircle, AlertTriangle, Copy, RefreshCw, Trash2, ShieldCheck, Star,
  FileText, Palette, Lock, CheckCircle2, Circle, Loader2, Shield, Send, ToggleLeft, ToggleRight,
  CreditCard, Eye, EyeOff, ChevronDown, ChevronRight, Bell, LayoutGrid,
} from 'lucide-react'
import { PageShell, PageHeader } from '@/components/patterns';
import { paymentGatewayApi } from '@/lib/api';
import { RoomTypeSettings } from '@/components/settings/RoomTypeSettings';

const CURRENCIES = [
  { code: 'BDT', label: 'BDT — Bangladeshi Taka (৳)' },
  { code: 'USD', label: 'USD — US Dollar ($)' },
  { code: 'EUR', label: 'EUR — Euro (€)' },
  { code: 'GBP', label: 'GBP — British Pound (£)' },
  { code: 'AUD', label: 'AUD — Australian Dollar (A$)' },
  { code: 'CAD', label: 'CAD — Canadian Dollar (C$)' },
  { code: 'SGD', label: 'SGD — Singapore Dollar (S$)' },
  { code: 'AED', label: 'AED — UAE Dirham (د.إ)' },
  { code: 'INR', label: 'INR — Indian Rupee (₹)' },
  { code: 'THB', label: 'THB — Thai Baht (฿)' },
  { code: 'IDR', label: 'IDR — Indonesian Rupiah (Rp)' },
  { code: 'MYR', label: 'MYR — Malaysian Ringgit (RM)' },
  { code: 'PKR', label: 'PKR — Pakistani Rupee (₨)' },
  { code: 'LKR', label: 'LKR — Sri Lankan Rupee (₨)' },
  { code: 'NPR', label: 'NPR — Nepalese Rupee (₨)' },
  { code: 'JPY', label: 'JPY — Japanese Yen (¥)' },
  { code: 'CNY', label: 'CNY — Chinese Yuan (¥)' },
  { code: 'PHP', label: 'PHP — Philippine Peso (₱)' },
  { code: 'VND', label: 'VND — Vietnamese Dong (₫)' },
];
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

type TabId =
  | 'general' | 'contact' | 'operations' | 'modules'
  | 'email' | 'notifications'
  | 'payments' | 'embed' | 'discovery'
  | 'domain' | 'gdpr' | 'enterprise';

type Tab = TabId;

interface TabItem {
  id: TabId;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
}

const TAB_GROUPS: Array<{ group: string; items: TabItem[] }> = [
  {
    group: 'Resort',
    items: [
      { id: 'general',    label: 'General',        icon: Building2 },
      { id: 'contact',    label: 'Contact',         icon: Phone },
      { id: 'operations', label: 'Operations',      icon: Clock },
      { id: 'modules',    label: 'Modules',         icon: LayoutGrid },
    ],
  },
  {
    group: 'Communications',
    items: [
      { id: 'email',         label: 'Email',           icon: Mail },
      { id: 'notifications', label: 'SMS & WhatsApp',  icon: Send },
    ],
  },
  {
    group: 'Monetisation',
    items: [
      { id: 'payments',  label: 'Payment Gateways', icon: CreditCard },
      { id: 'embed',     label: 'Embed & Widget',   icon: ExternalLink },
      { id: 'discovery', label: 'Discovery Map',    icon: MapPin },
    ],
  },
  {
    group: 'Advanced',
    items: [
      { id: 'domain',     label: 'Custom Domain',   icon: Globe },
      { id: 'gdpr',       label: 'Privacy & GDPR',  icon: ShieldCheck },
      { id: 'enterprise', label: 'Enterprise',      icon: Star },
    ],
  },
];

// Flat list for easy lookup
const TABS = TAB_GROUPS.flatMap(g => g.items);

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { tenant, token, user } = useAuthStore();
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
    currency: 'BDT',
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
        currency: t.currency ?? 'BDT',
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

  // ── Email settings state ─────────────────────────────────────────────────
  const [emailSettings, setEmailSettings] = useState({
    sendConfirmation: true,
    sendPreArrival: true,
    sendCheckoutInvoice: true,
    sendCancellation: true,
    replyToEmail: '',
    footerText: '',
  });
  const [testEmailAddr, setTestEmailAddr] = useState('');
  const [testSending, setTestSending] = useState(false);

  const { data: emailSettingsData } = useQuery({
    queryKey: ['email-settings'],
    queryFn: () => tenantApi.getEmailSettings(),
    enabled: tab === 'email',
  });

  useEffect(() => {
    const es = emailSettingsData?.data?.data;
    if (es) {
      setEmailSettings({
        sendConfirmation: es.sendConfirmation ?? true,
        sendPreArrival: es.sendPreArrival ?? true,
        sendCheckoutInvoice: es.sendCheckoutInvoice ?? true,
        sendCancellation: es.sendCancellation ?? true,
        replyToEmail: es.replyToEmail ?? '',
        footerText: es.footerText ?? '',
      });
    }
  }, [emailSettingsData]);

  const saveEmailSettings = useMutation({
    mutationFn: () => tenantApi.updateEmailSettings(emailSettings),
    onSuccess: () => toast({ title: 'Email settings saved!' }),
    onError: () => toast({ title: 'Save failed', variant: 'destructive' }),
  });

  const handleTestEmail = async () => {
    if (!testEmailAddr) return;
    setTestSending(true);
    try {
      await tenantApi.sendTestEmail(testEmailAddr);
      toast({ title: `Test email sent to ${testEmailAddr}` });
    } catch {
      toast({ title: 'Failed to send test email', variant: 'destructive' });
    }
    setTestSending(false);
  };

  // ── Custom domain state ──────────────────────────────────────────────────
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
  const [sslStatus, setSslStatus] = useState<{
    sslStatus: string | null;
    sslProvisionedAt: string | null;
    sslExpiresAt: string | null;
    sslError: string | null;
    daysUntilExpiry: number | null;
  } | null>(null);
  const [sslProvisioning, setSslProvisioning] = useState(false);

  useEffect(() => {
    if (tenantData?.customDomain !== undefined) {
      setDomainInput(tenantData.customDomain ?? '');
      setDomainStatus({
        customDomain:   tenantData.customDomain,
        domainVerified: tenantData.domainVerified ?? false,
      });
      // Fetch full domain/SSL status if domain is set
      if (tenantData.customDomain) {
        api.get('/tenant/domain/status', { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => {
            const d = r.data.data;
            setSslStatus({
              sslStatus: d.sslStatus,
              sslProvisionedAt: d.sslProvisionedAt,
              sslExpiresAt: d.sslExpiresAt,
              sslError: d.sslError,
              daysUntilExpiry: d.daysUntilExpiry,
            });
          })
          .catch(() => {});
      }
    }
  }, [tenantData, token]);

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
    setDomainSaving(true);
    try {
      await api.put('/tenant/domain', { domain: null }, { headers: { Authorization: `Bearer ${token}` } });
      setDomainInput('');
      setDomainStatus({ customDomain: null, domainVerified: false });
      toast({ title: 'Custom domain removed' });
    } catch { /* ignore */ }
    setDomainSaving(false);
  };

  const provisionSsl = async () => {
    setSslProvisioning(true);
    try {
      await api.post('/tenant/domain/provision-ssl', {}, { headers: { Authorization: `Bearer ${token}` } });
      setSslStatus((s) => s ? { ...s, sslStatus: 'provisioning' } : s);
      toast({ title: 'SSL provisioning started — usually completes within 5 minutes' });
    } catch (e: any) {
      toast({ title: 'SSL provisioning failed', description: e?.response?.data?.error, variant: 'destructive' });
    }
    setSslProvisioning(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!' });
  };

  if (isLoading) {
    return <div className="h-64 rounded-xl bg-gray-100 animate-pulse" />;
  }

  // Active tab label for mobile breadcrumb
  const activeTab = TABS.find(t => t.id === tab);

  return (
    <PageShell gap={5}>
      {/* Page header */}
      <div className="flex items-end justify-between">
        <PageHeader
          title="Settings"
          subtitle="Manage your resort configuration"
        />
      </div>

      {/* Tenant Info Banner */}
      {tenant && (
        <div className="flex items-center gap-3 rounded-[10px] border px-5 py-3"
          style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(24,49,83,0.18)' }}>
          <Info className="h-4 w-4 shrink-0" style={{ color: '#183153' }} />
          <p className="text-[13px]" style={{ color: '#183153' }}>
            Managing <strong>{tenant.name}</strong> — slug:{' '}
            <code className="font-mono rounded-[5px] px-1.5 py-0.5 text-[12px]"
              style={{ background: 'rgba(24,49,83,0.12)', color: '#183153' }}>{tenant.slug}</code>
          </p>
        </div>
      )}

      {/* Settings layout: stacked on mobile (selector above content), sidebar + content on md+ */}
      <div className="flex flex-col gap-4 md:flex-row md:gap-6 md:items-start">

        {/* ── Left sidebar nav ───────────────────────────────────────────── */}
        <aside className="hidden md:flex flex-col gap-5 w-48 flex-shrink-0 sticky top-4">
          {TAB_GROUPS.map(({ group, items }) => (
            <div key={group}>
              <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                {group}
              </p>
              <nav className="flex flex-col gap-0.5">
                {items.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className="flex items-center gap-2.5 rounded-[8px] px-3 py-[8px] text-[13px] font-medium transition-colors text-left w-full"
                    style={tab === id
                      ? { background: 'var(--rp-teal-bg)', color: '#183153' }
                      : { color: 'var(--rp-text-subtle)' }}
                  >
                    <Icon className="h-[15px] w-[15px] flex-shrink-0"
                      style={{ color: tab === id ? '#183153' : '#aac0d0' }} />
                    {label}
                  </button>
                ))}
              </nav>
            </div>
          ))}
        </aside>

        {/* ── Mobile tab selector ────────────────────────────────────────── */}
        <div className="md:hidden w-full">
          <select
            value={tab}
            onChange={e => setTab(e.target.value as Tab)}
            className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-2 text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-resort-600/20"
          >
            {TAB_GROUPS.map(({ group, items }) => (
              <optgroup key={group} label={group}>
                {items.map(({ id, label }) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* ── Content area ───────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

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
                  <span className="flex items-center px-3 bg-gray-50 text-sm text-muted-foreground border-r">resortpro.site/</span>
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
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Banknote className="h-4 w-4 text-resort-600" /> Locale & Currency</h3>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Currency</label>
                <select value={form.currency} onChange={e => set('currency', e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
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

      {/* Email Settings */}
      {tab === 'email' && (
        <div className="space-y-5 max-w-2xl">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Automatic Guest Emails</h3>
                <p className="text-sm text-muted-foreground">Toggle which emails are sent automatically to guests during their booking journey.</p>
              </div>

              {[
                { key: 'sendConfirmation' as const,    label: 'Booking Confirmation',  desc: 'Sent immediately when a booking is created' },
                { key: 'sendPreArrival' as const,      label: 'Pre-Arrival Reminder',  desc: 'Sent 1 day before check-in (daily at 9 AM)' },
                { key: 'sendCheckoutInvoice' as const, label: 'Checkout Invoice',       desc: 'Sent with full invoice when guest checks out' },
                { key: 'sendCancellation' as const,    label: 'Cancellation Notice',   desc: 'Sent when a booking is cancelled' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmailSettings(s => ({ ...s, [key]: !s[key] }))}
                  >
                    {emailSettings[key]
                      ? <ToggleRight className="h-7 w-7 text-resort-600" />
                      : <ToggleLeft className="h-7 w-7 text-gray-300" />}
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Email Branding</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reply-to Email</label>
                <Input
                  type="email"
                  placeholder="reservations@yourresort.com"
                  value={emailSettings.replyToEmail}
                  onChange={e => setEmailSettings(s => ({ ...s, replyToEmail: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">Guests will reply to this address. Defaults to your resort email.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Footer Text</label>
                <textarea
                  rows={2}
                  placeholder="Thank you for choosing us. We look forward to your next visit!"
                  value={emailSettings.footerText}
                  onChange={e => setEmailSettings(s => ({ ...s, footerText: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
              <Button
                className="bg-resort-600 hover:bg-resort-700 text-white gap-2"
                onClick={() => saveEmailSettings.mutate()}
                disabled={saveEmailSettings.isPending}
              >
                {saveEmailSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Email Settings
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Send Test Email</h3>
                <p className="text-sm text-muted-foreground">Send a test email to verify your settings look correct.</p>
              </div>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder={user?.email ?? 'you@example.com'}
                  value={testEmailAddr}
                  onChange={e => setTestEmailAddr(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  className="gap-2 shrink-0"
                  onClick={handleTestEmail}
                  disabled={!testEmailAddr || testSending}
                >
                  {testSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send Test
                </Button>
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

              {/* SSL status */}
              {domainStatus?.domainVerified && sslStatus && (
                <div className={`rounded-xl border p-4 space-y-2 ${
                  sslStatus.sslStatus === 'active' ? 'bg-emerald-50 border-emerald-200' :
                  sslStatus.sslStatus === 'error'  ? 'bg-red-50 border-red-200' :
                  sslStatus.sslStatus === 'provisioning' ? 'bg-indigo-50 border-indigo-200' :
                  'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                      {sslStatus.sslStatus === 'active' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> :
                       sslStatus.sslStatus === 'error'  ? <XCircle className="w-4 h-4 text-red-500" /> :
                       sslStatus.sslStatus === 'provisioning' ? <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" /> :
                       <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      SSL Certificate
                    </p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      sslStatus.sslStatus === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      sslStatus.sslStatus === 'error'  ? 'bg-red-100 text-red-700' :
                      sslStatus.sslStatus === 'provisioning' ? 'bg-indigo-100 text-indigo-700' :
                      'bg-gray-200 text-gray-600'
                    }`}>
                      {sslStatus.sslStatus === 'active' ? 'Active' :
                       sslStatus.sslStatus === 'provisioning' ? 'Provisioning…' :
                       sslStatus.sslStatus === 'error' ? 'Error' : 'Not provisioned'}
                    </span>
                  </div>
                  {sslStatus.sslStatus === 'active' && sslStatus.daysUntilExpiry !== null && (
                    <p className="text-xs text-emerald-700">
                      ✓ HTTPS active · Expires in <strong>{sslStatus.daysUntilExpiry} days</strong>
                      {sslStatus.sslExpiresAt && ` (${new Date(sslStatus.sslExpiresAt).toLocaleDateString()})`}
                    </p>
                  )}
                  {sslStatus.sslStatus === 'error' && sslStatus.sslError && (
                    <p className="text-xs text-red-600">{sslStatus.sslError}</p>
                  )}
                  {sslStatus.sslStatus === 'provisioning' && (
                    <p className="text-xs text-indigo-700">Certificate is being issued — this usually takes 1–5 minutes.</p>
                  )}
                  {(sslStatus.sslStatus === 'none' || sslStatus.sslStatus === 'error' || !sslStatus.sslStatus) && (
                    <Button size="sm" onClick={provisionSsl} loading={sslProvisioning}
                      className="w-full gap-2 mt-1 bg-resort-700 hover:bg-resort-800">
                      <Shield className="h-3.5 w-3.5" /> Provision SSL Certificate
                    </Button>
                  )}
                </div>
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
                            {domainStatus.cnameTarget ?? `${tenantData?.slug}.resortpro.site`}
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
                    { n: 3, text: `Add a CNAME record pointing to: ${domainStatus.cnameTarget ?? `${tenantData?.slug}.resortpro.site`}` },
                    { n: 4, text: 'Save changes — DNS propagation takes 15 min to 48 hours' },
                    { n: 5, text: 'Come back here and click "Verify Domain"' },
                  ].map(({ n, text }) => (
                    <div key={n} className="flex items-start gap-3">
                      <span className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: '#183153' }}>{n}</span>
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

      {tab === 'modules' && (
        <ModulesTab />
      )}

      {tab === 'notifications' && (
        <NotificationsTab />
      )}

      {tab === 'payments' && (
        <PaymentGatewaysTab />
      )}

      {tab === 'embed' && (
        <EmbedTab />
      )}

      {tab === 'gdpr' && (
        <GdprTab />
      )}

      {tab === 'enterprise' && (
        <EnterpriseTab />
      )}

      {tab === 'discovery' && (
        <DiscoveryMapTab />
      )}

      {/* Save — general tabs (general, contact, operations, email) */}
      {(tab === 'general' || tab === 'contact' || tab === 'operations') && (
        <div className="flex justify-end pt-2">
          <Button className="gap-2 px-8" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      )}

        </div>
      </div>
    </PageShell>
  );
}

// ── Payment Gateways Tab ──────────────────────────────────────────────────

// Gateway metadata for UI display (logo colors, descriptions, docs links)
const GATEWAY_UI: Record<string, {
  bg: string; accent: string; logoText?: string; description: string; docsUrl?: string;
}> = {
  bkash:      { bg: 'bg-pink-50',   accent: 'text-pink-600',   logoText: '৳',  description: 'Mobile banking — most popular in Bangladesh', docsUrl: 'https://developer.bka.sh' },
  nagad:      { bg: 'bg-orange-50', accent: 'text-orange-600', logoText: 'ন',  description: 'Bangladesh Post Office digital wallet', docsUrl: 'https://nagad.com.bd/api' },
  sslcommerz: { bg: 'bg-green-50',  accent: 'text-green-700',  logoText: 'SSL', description: 'Cards, bKash, Nagad, Rocket, bank transfer', docsUrl: 'https://developer.sslcommerz.com' },
  razorpay:   { bg: 'bg-blue-50',   accent: 'text-blue-700',   logoText: 'R',   description: 'India\'s leading payment gateway — cards, UPI, netbanking', docsUrl: 'https://razorpay.com/docs' },
  cashfree:   { bg: 'bg-sky-50',    accent: 'text-sky-700',    logoText: 'CF',  description: 'India — fast settlements, low fees', docsUrl: 'https://docs.cashfree.com' },
  payhere:    { bg: 'bg-teal-50',   accent: 'text-teal-700',   logoText: 'PH',  description: 'Sri Lanka — cards, bank slips, Sampath Vishwa', docsUrl: 'https://support.payhere.lk' },
  esewa:      { bg: 'bg-emerald-50',accent: 'text-emerald-700',logoText: 'e',   description: 'Nepal\'s leading digital wallet & payment gateway', docsUrl: 'https://developer.esewa.com.np' },
  khalti:     { bg: 'bg-violet-50', accent: 'text-violet-700', logoText: 'K',   description: 'Nepal — wallet, cards, bank transfer', docsUrl: 'https://docs.khalti.com' },
  stripe:     { bg: 'bg-indigo-50', accent: 'text-indigo-600', logoText: '💳',  description: 'International cards — Visa, Mastercard, Amex, Apple Pay', docsUrl: 'https://stripe.com/docs' },
  paypal:     { bg: 'bg-blue-50',   accent: 'text-blue-800',   logoText: 'PP',  description: 'Global — PayPal wallet, cards (coming soon)', docsUrl: 'https://developer.paypal.com' },
  midtrans:   { bg: 'bg-red-50',    accent: 'text-red-600',    logoText: '🇮🇩',  description: 'Indonesia — GoPay, OVO, cards (coming soon)' },
  omise:      { bg: 'bg-sky-50',    accent: 'text-sky-600',    logoText: '🇹🇭',  description: 'Thailand — PromptPay, TrueMoney, cards (coming soon)' },
  ipay88:     { bg: 'bg-amber-50',  accent: 'text-amber-700',  logoText: '🇲🇾',  description: 'Malaysia — FPX, cards (coming soon)' },
  mpesa:      { bg: 'bg-green-50',  accent: 'text-green-700',  logoText: '🇰🇪',  description: 'Kenya — mobile money (coming soon)' },
  flutterwave:{ bg: 'bg-orange-50', accent: 'text-orange-600', logoText: '🌍',  description: 'Africa — Nigeria, Ghana, Kenya (coming soon)' },
  paystack:   { bg: 'bg-teal-50',   accent: 'text-teal-700',   logoText: '🇳🇬',  description: 'Nigeria, Ghana — cards, bank (coming soon)' },
};

interface GatewayMeta {
  id: string;
  name: string;
  logo: string;
  countries: string[];
  methods: string[];
  status: 'active' | 'stub' | 'coming_soon';
  testMode: boolean;
  redirectFlow: boolean;
  credentialFields: { key: string; label: string; type: 'text' | 'password' | 'select'; required: boolean; placeholder?: string }[];
}

function GatewayCard({
  gw,
  isEnabled,
  credentials,
  testMode,
  onToggle,
  onCredentialChange,
  onTestModeChange,
  onSave,
  saving,
}: {
  gw: GatewayMeta;
  isEnabled: boolean;
  credentials: Record<string, string>;
  testMode: boolean;
  onToggle: () => void;
  onCredentialChange: (key: string, value: string) => void;
  onTestModeChange: (v: boolean) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showPass, setShowPass] = useState<Record<string, boolean>>({});
  const ui = GATEWAY_UI[gw.id] ?? { bg: 'bg-gray-50', accent: 'text-gray-600', description: gw.name };
  const isComingSoon = gw.status === 'coming_soon' || gw.status === 'stub';

  return (
    <Card className={isComingSoon ? 'opacity-70' : ''}>
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${ui.bg} flex items-center justify-center flex-shrink-0`}>
            <span className={`text-sm font-bold ${ui.accent}`}>{ui.logoText ?? gw.logo}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-800">{gw.name}</p>
              {isComingSoon && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Coming Soon</span>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate">{ui.description}</p>
          </div>
          {!isComingSoon && (
            <button type="button" onClick={onToggle} className="flex-shrink-0">
              {isEnabled
                ? <ToggleRight className={`h-7 w-7 ${ui.accent}`} />
                : <ToggleLeft  className="h-7 w-7 text-gray-300" />}
            </button>
          )}
          {!isComingSoon && gw.credentialFields.length > 0 && (
            <button type="button" onClick={() => setOpen(o => !o)} className="text-gray-400 ml-1 flex-shrink-0">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Credential fields (expandable) */}
        {open && !isComingSoon && (
          <div className="space-y-3 pt-1 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-3">
              {gw.credentialFields.map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  <div className="relative">
                    <Input
                      type={field.type === 'password' && !showPass[field.key] ? 'password' : 'text'}
                      value={credentials[field.key] ?? ''}
                      onChange={e => onCredentialChange(field.key, e.target.value)}
                      placeholder={
                        credentials[field.key]?.startsWith('••••••••')
                          ? credentials[field.key]  // show masked value as placeholder
                          : (field.placeholder ?? (field.type === 'password' ? 'Enter to update' : ''))
                      }
                      className={field.type === 'password' ? 'pr-9' : ''}
                    />
                    {field.type === 'password' && (
                      <button type="button"
                        onClick={() => setShowPass(s => ({ ...s, [field.key]: !s[field.key] }))}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPass[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Test/Live mode toggle */}
            {gw.testMode && (
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">Live Mode</p>
                  <p className="text-xs text-gray-500">Sandbox for testing — enable Live Mode for real payments</p>
                </div>
                <button type="button" onClick={() => onTestModeChange(!testMode)}>
                  {!testMode
                    ? <ToggleRight className="h-7 w-7 text-emerald-600" />
                    : <ToggleLeft  className="h-7 w-7 text-gray-300" />}
                </button>
              </div>
            )}

            {!testMode && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700">Live mode is on — real payments will be processed</p>
              </div>
            )}

            {ui.docsUrl && (
              <p className="text-xs text-gray-400">
                Get credentials from{' '}
                <a href={ui.docsUrl} target="_blank" rel="noopener noreferrer"
                  className={`${ui.accent} underline`}>{ui.docsUrl.replace('https://', '').split('/')[0]}</a>.
                Leave secret fields blank to keep existing values.
              </p>
            )}

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={onSave}
                disabled={saving}
                className={`gap-2 ${ui.bg.replace('bg-', 'bg-').replace('-50', '-600')} hover:opacity-90 text-white`}
              >
                {saving
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Save className="h-3.5 w-3.5" />}
                Save {gw.name}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentGatewaysTab() {
  const { tenant } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null) // gatewayId being saved

  // Config state
  const [enabledMethods, setEnabledMethods] = useState<string[]>(['manual'])
  const [testMode, setTestMode] = useState(true)
  const [manualInstructions, setManualInstructions] = useState('')
  // credentials per gateway: { bkash: { appKey: '...', ... }, ... }
  const [credentialsMap, setCredentialsMap] = useState<Record<string, Record<string, string>>>({})
  // Available gateways from registry (for tenant's country)
  const [gateways, setGateways] = useState<GatewayMeta[]>([])
  // All gateways for "other options" section
  const [allGateways, setAllGateways] = useState<GatewayMeta[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const [configRes, gwRes] = await Promise.all([
          paymentGatewayApi.getConfig(),
          paymentGatewayApi.getGatewaysForCountry((tenant as any)?.country ?? 'BD'),
        ])
        const cfg = configRes.data.data ?? configRes.data
        setEnabledMethods(cfg.enabledMethods ?? ['manual'])
        setTestMode(cfg.testMode ?? true)
        setManualInstructions(cfg.manualInstructions ?? '')

        // Build credentialsMap from masked credentials
        // API returns: { bkash: { appKey: '••••••••1234', appSecret: '••••••••abcd' }, ... }
        const raw = cfg.credentials ?? {}
        const map: Record<string, Record<string, string>> = {}
        for (const [gwId, gwCreds] of Object.entries(raw as Record<string, unknown>)) {
          if (gwCreds && typeof gwCreds === 'object') {
            map[gwId] = gwCreds as Record<string, string>
          }
        }
        setCredentialsMap(map)

        // Also set from availableGateways if included in config response
        if (cfg.availableGateways) {
          setGateways(cfg.availableGateways)
        } else {
          setGateways(gwRes.data.data ?? gwRes.data ?? [])
        }
      } catch {
        // If config endpoint fails (new tenant), just load gateways
        try {
          const gwRes = await paymentGatewayApi.getGatewaysForCountry((tenant as any)?.country ?? 'BD')
          setGateways(gwRes.data.data ?? gwRes.data ?? [])
        } catch {}
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tenant])

  const handleSave = async (gatewayId: string) => {
    setSaving(gatewayId)
    try {
      // Build nested credentials: { bkash: { appKey: '...', appSecret: '...' } }
      const gwCreds = credentialsMap[gatewayId] ?? {}
      const nestedCreds: Record<string, Record<string, string>> = {}
      if (Object.keys(gwCreds).length > 0) {
        nestedCreds[gatewayId] = gwCreds // API will skip masked '••••••••' values
      }

      const isEnabled = enabledMethods.includes(gatewayId)
      const newMethods = isEnabled
        ? enabledMethods
        : [...enabledMethods.filter(m => m !== gatewayId)]

      await paymentGatewayApi.saveConfig({
        activeGateway: enabledMethods[0] ?? gatewayId, // first enabled = primary
        enabledMethods: newMethods,
        credentials: nestedCreds,
        testMode,
        manualInstructions: manualInstructions || undefined,
      })

      // Clear entered secrets (security)
      setCredentialsMap(prev => {
        const updated = { ...prev }
        const gw = gateways.find(g => g.id === gatewayId)
        if (gw) {
          const cleared = { ...updated[gatewayId] }
          gw.credentialFields.forEach(f => {
            if (f.type === 'password' && cleared[f.key] && !cleared[f.key].startsWith('••••••••')) {
              cleared[f.key] = '' // clear after save
            }
          })
          updated[gatewayId] = cleared
        }
        return updated
      })

      toast({ title: `✅ ${gatewayId === 'manual' ? 'Manual payment' : gatewayId.charAt(0).toUpperCase() + gatewayId.slice(1)} saved!` })
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.response?.data?.error ?? 'Please try again', variant: 'destructive' })
    } finally {
      setSaving(null)
    }
  }

  const toggleGateway = (gatewayId: string) => {
    setEnabledMethods(prev =>
      prev.includes(gatewayId)
        ? prev.filter(m => m !== gatewayId)
        : [...prev, gatewayId]
    )
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}
      </div>
    )
  }

  // Split gateways: Phase 1 (active) vs Phase 2 stubs
  const activeGws  = gateways.filter(g => g.id !== 'manual' && g.status === 'active')
  const stubGws    = gateways.filter(g => g.id !== 'manual' && g.status !== 'active')

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3">
        <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          Enable payment gateways to accept online payments from guests.
          Toggle a gateway on, enter credentials, and save.
          Secrets are stored encrypted and never shown in full after saving.
        </p>
      </div>

      {/* Global test mode banner */}
      {testMode && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 flex-1">
            <strong>Sandbox mode active</strong> — all gateways use test credentials. No real money will be charged.
          </p>
          <Button size="sm" variant="outline"
            className="text-amber-700 border-amber-300 hover:bg-amber-100 text-xs"
            onClick={() => {
              setTestMode(false)
              toast({ title: '⚠️ Live mode enabled', description: 'Real payments will be processed. Make sure your credentials are live keys.' })
            }}>
            Enable Live
          </Button>
        </div>
      )}

      {/* Manual Payment — always on */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">🏨</div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-gray-800">Manual Payment (Pay at Hotel)</p>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">Always on</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">Guest selects "Pay at Hotel" — booking saved as Pending until you confirm payment.</p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Instructions (shown to guest)</label>
                <textarea
                  value={manualInstructions}
                  onChange={e => setManualInstructions(e.target.value)}
                  rows={2}
                  placeholder="e.g. Pay at front desk on arrival. Bank transfer: ABC Bank, A/C: 1234567890"
                  className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </div>
              <div className="flex justify-end mt-2">
                <Button size="sm" onClick={() => handleSave('manual')} disabled={saving === 'manual'}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                  {saving === 'manual' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save Instructions
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active (Phase 1) gateways */}
      {activeGws.length > 0 && (
        <>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Available for your region</p>
          {activeGws.map(gw => (
            <GatewayCard
              key={gw.id}
              gw={gw}
              isEnabled={enabledMethods.includes(gw.id)}
              credentials={credentialsMap[gw.id] ?? {}}
              testMode={testMode}
              onToggle={() => toggleGateway(gw.id)}
              onCredentialChange={(key, val) =>
                setCredentialsMap(prev => ({ ...prev, [gw.id]: { ...(prev[gw.id] ?? {}), [key]: val } }))
              }
              onTestModeChange={setTestMode}
              onSave={() => handleSave(gw.id)}
              saving={saving === gw.id}
            />
          ))}
        </>
      )}

      {/* Coming soon stubs */}
      {stubGws.length > 0 && (
        <>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 pt-2">Coming Soon</p>
          {stubGws.map(gw => (
            <GatewayCard
              key={gw.id}
              gw={gw}
              isEnabled={false}
              credentials={{}}
              testMode={true}
              onToggle={() => {}}
              onCredentialChange={() => {}}
              onTestModeChange={() => {}}
              onSave={() => {}}
              saving={false}
            />
          ))}
        </>
      )}

      {/* No gateways loaded */}
      {activeGws.length === 0 && stubGws.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
          <CreditCard className="h-8 w-8" />
          <p className="text-sm">No payment gateways available for your region.</p>
          <p className="text-xs">Contact support to add gateway support for your country.</p>
        </div>
      )}
    </div>
  )
}

// ── GDPR Tab ──────────────────────────────────────────────────────────────

function GdprTab() {
  const [exportLoading, setExportLoading] = useState(false);
  const [erasureLoading, setErasureLoading] = useState(false);
  const [erasureRequested, setErasureRequested] = useState(false);

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res = await api.get('/tenant/gdpr/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Data export downloaded' });
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    } finally {
      setExportLoading(false);
    }
  };

  const handleErasure = async () => {
    if (!confirm('Request deletion of all your resort data? You have 30 days to cancel before it becomes permanent.')) return;
    setErasureLoading(true);
    try {
      await api.post('/tenant/gdpr/request-erasure');
      setErasureRequested(true);
      toast({ title: 'Erasure request submitted', description: 'You have 30 days to contact support to cancel.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.response?.data?.error || 'Failed', variant: 'destructive' });
    } finally {
      setErasureLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Info */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-3 mb-5">
            <ShieldCheck className="w-5 h-5 text-resort-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-800">Your Privacy Rights (GDPR)</h3>
              <p className="text-sm text-gray-500 mt-1">
                Under GDPR you have the right to access, export, and delete your personal data.
                These actions apply to your resort account and all associated data.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Data Export */}
            <div className="flex items-start justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-800">Export Your Data</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Download a complete JSON export of your resort data including bookings, guests, and users (Article 20).
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                loading={exportLoading}
                onClick={handleExport}
                className="shrink-0 gap-2"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Export Data
              </Button>
            </div>

            {/* Erasure */}
            <div className="flex items-start justify-between gap-4 p-4 bg-red-50 rounded-xl border border-red-200">
              <div>
                <p className="text-sm font-medium text-red-800">Request Data Erasure</p>
                <p className="text-xs text-red-600 mt-0.5">
                  Permanently delete all personal data associated with your account (Article 17).
                  You have <strong>30 days</strong> to cancel after requesting. Financial records are retained for legal compliance.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                loading={erasureLoading}
                disabled={erasureRequested}
                onClick={handleErasure}
                className="shrink-0 gap-2 border-red-300 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {erasureRequested ? 'Requested' : 'Request Erasure'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy notice */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          For questions about data processing or to exercise other GDPR rights, contact us at{' '}
          <a href="mailto:privacy@resortpro.site" className="underline font-medium">privacy@resortpro.site</a>.
          We respond within 72 hours.
        </p>
      </div>
    </div>
  );
}

// ── Enterprise Tab ────────────────────────────────────────────────────────────

const ONBOARDING_LABELS = [
  'Account Created',
  'Profile & Branding Complete',
  'SSO Configured',
  'White-label Active',
  'SLA Agreement Signed',
  'Training & Onboarding Done',
  'Go-live ✓',
];

function EnterpriseTab() {
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{
    plan: string;
    whitelabelEnabled: boolean;
    brandLogoUrl: string | null;
    brandPrimaryColor: string | null;
    brandAccentColor: string | null;
    companyDisplayName: string | null;
    ssoEnabled: boolean;
    ssoProvider: string | null;
    ssoClientId: string | null;
    onboardingStep: number;
    onboardingCompletedAt: string | null;
    slaAgreement: {
      tier: string;
      uptimePercent: number;
      responseTimeH: number;
      contractStart: string;
      contractEnd: string | null;
      signedAt: string | null;
    } | null;
  } | null>(null);

  useEffect(() => {
    api.get('/tenant/enterprise', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setProfile(r.data.data))
      .catch(() => {/* non-enterprise tenants just get null */ })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const isEnterprise = profile?.plan === 'ENTERPRISE';

  if (!isEnterprise) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Star className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <p className="text-gray-800 font-semibold">Enterprise features</p>
          <p className="text-gray-500 text-sm mt-1 max-w-sm">
            SLA agreements, SSO, and white-label branding are available on the Enterprise plan.
            Contact <a href="mailto:sales@resortpro.site" className="text-indigo-600 underline">sales@resortpro.site</a> to upgrade.
          </p>
        </div>
      </div>
    );
  }

  const sla = profile?.slaAgreement;
  const step = profile?.onboardingStep ?? 0;
  const done = !!profile?.onboardingCompletedAt;
  const onboardPct = Math.round((step / 6) * 100);

  return (
    <div className="space-y-6">
      {/* Onboarding progress */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-gray-800">Enterprise Onboarding</h3>
            <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
              {done ? 'Complete' : `${onboardPct}%`}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${done ? 'bg-emerald-500' : 'bg-indigo-500'}`}
              style={{ width: `${onboardPct}%` }}
            />
          </div>
          <div className="space-y-2">
            {ONBOARDING_LABELS.map((label, idx) => {
              const isDone = idx < step || done;
              const isCurrent = idx === step && !done;
              return (
                <div key={idx} className="flex items-center gap-2.5">
                  {isDone
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    : <Circle className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-indigo-400' : 'text-gray-300'}`} />
                  }
                  <span className={`text-sm ${isDone ? 'text-gray-700' : isCurrent ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                    {label}
                  </span>
                  {isCurrent && <span className="text-xs text-indigo-600 font-medium ml-auto">← Current</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* SLA */}
      {sla ? (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-indigo-600" />
              <h3 className="font-semibold text-gray-800">SLA Agreement</h3>
              <span className="ml-auto text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">
                {sla.tier}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Uptime SLA', value: `${sla.uptimePercent}%` },
                { label: 'Response time', value: `${sla.responseTimeH}h` },
                { label: 'Contract start', value: new Date(sla.contractStart).toLocaleDateString() },
                { label: 'Contract end', value: sla.contractEnd ? new Date(sla.contractEnd).toLocaleDateString() : 'Open-ended' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {sla.signedAt && (
              <p className="text-xs text-gray-500 mt-3">
                ✓ Agreement signed on {new Date(sla.signedAt).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800">No SLA agreement on file. Contact your account manager to set one up.</p>
        </div>
      )}

      {/* White-label */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Palette className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-gray-800">White-label Branding</h3>
            <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${profile?.whitelabelEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              {profile?.whitelabelEnabled ? 'Active' : 'Inactive'}
            </span>
          </div>
          {profile?.whitelabelEnabled ? (
            <div className="space-y-2">
              {profile.companyDisplayName && (
                <p className="text-sm text-gray-700">Display name: <span className="font-medium">{profile.companyDisplayName}</span></p>
              )}
              <div className="flex items-center gap-2">
                {profile.brandPrimaryColor && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded" style={{ background: profile.brandPrimaryColor }} />
                    <span className="text-xs text-gray-500 font-mono">{profile.brandPrimaryColor}</span>
                  </div>
                )}
                {profile.brandAccentColor && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded" style={{ background: profile.brandAccentColor }} />
                    <span className="text-xs text-gray-500 font-mono">{profile.brandAccentColor}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">Contact your account manager to update branding.</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">White-label branding is not active. Contact your account manager to enable it.</p>
          )}
        </CardContent>
      </Card>

      {/* SSO */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-gray-800">Single Sign-On (SSO)</h3>
            <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${profile?.ssoEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              {profile?.ssoEnabled ? 'Enabled' : 'Not configured'}
            </span>
          </div>
          {profile?.ssoEnabled ? (
            <div className="space-y-1.5">
              <p className="text-sm text-gray-700">
                Provider: <span className="font-medium capitalize">{profile.ssoProvider}</span>
              </p>
              {profile.ssoClientId && (
                <p className="text-sm text-gray-700">
                  Client ID: <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{profile.ssoClientId}</code>
                </p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                SSO callback URL: <code className="font-mono">https://app.resortpro.site/auth/sso/callback</code>
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">SSO is not configured. Contact your account manager to set up SSO for your team.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-50 border border-indigo-200">
        <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-xs text-indigo-700 leading-relaxed">
          Enterprise settings are managed by your ResortPro account manager.
          Contact <a href="mailto:enterprise@resortpro.site" className="underline font-medium">enterprise@resortpro.site</a> for changes.
        </p>
      </div>
    </div>
  );
}


// ── Embed & Widget Tab ────────────────────────────────────────────────────────

function EmbedTab() {
  const { tenant } = useAuthStore()
  const slug = tenant?.slug || ''
  const cdnBase = 'https://cdn.resortpro.site'
  const [copied, setCopied] = useState<string | null>(null)

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const scriptTag = `<script src="${cdnBase}/embed.js" defer></script>`

  const widgets = [
    {
      key: 'booking',
      label: 'Booking Form',
      description: 'Full 4-step booking flow with payment support',
      snippet: `<div data-resortpro="booking" data-slug="${slug}"></div>`,
      preview: '📅 Dates → 🛏️ Rooms → 👤 Guest Details → 💳 Payment',
    },
    {
      key: 'rooms',
      label: 'Room Listing',
      description: 'Responsive grid of available rooms with images and prices',
      snippet: `<div data-resortpro="rooms" data-slug="${slug}"></div>`,
      preview: '🛏️ Room cards with images, prices, and Book Now buttons',
    },
    {
      key: 'calendar',
      label: 'Availability Calendar',
      description: 'Monthly calendar showing available and booked dates',
      snippet: `<div data-resortpro="calendar" data-slug="${slug}"></div>`,
      preview: '📆 Green = available, Red = fully booked, Yellow = partial',
    },
    {
      key: 'menu',
      label: 'Food Menu & Order',
      description: 'Restaurant menu with category filter, cart, and order form',
      snippet: `<div data-resortpro="menu" data-slug="${slug}"></div>`,
      preview: '🍽️ Menu items → 🛒 Cart → 📝 Order placed',
    },
    {
      key: 'cta',
      label: 'Floating CTA Button',
      description: 'Sticky "Book Now" button with optional WhatsApp link',
      snippet: `<div data-resortpro="cta" data-slug="${slug}" data-whatsapp="+8801700000000"></div>`,
      preview: '💬 Fixed bottom-right button that opens the booking form',
    },
  ]

  const wpPluginUrl = `${cdnBase}/resortpro-wp-plugin.zip`

  return (
    <div className="space-y-6">
      {/* Step 1 — Script tag */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <span className="bg-resort-600 text-white text-xs font-bold px-2 py-0.5 rounded">Step 1</span>
            Add the script tag
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Paste this once in the <code className="bg-gray-100 px-1 rounded text-xs">&lt;head&gt;</code> or before
            the <code className="bg-gray-100 px-1 rounded text-xs">&lt;/body&gt;</code> of your website.
          </p>
          <div className="relative bg-gray-950 rounded-lg p-4 pr-12">
            <code className="text-green-400 text-sm font-mono break-all">{scriptTag}</code>
            <button
              onClick={() => copy(scriptTag, 'script')}
              className="absolute top-3 right-3 p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              title="Copy"
            >
              {copied === 'script' ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Step 2 — Widget snippets */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <span className="bg-resort-600 text-white text-xs font-bold px-2 py-0.5 rounded">Step 2</span>
            Place widget(s) where you want them
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Copy any snippet below and paste it into your page HTML where you want the widget to appear.
          </p>

          <div className="space-y-4">
            {widgets.map(w => (
              <div key={w.key} className="border border-gray-200 rounded-lg p-4 hover:border-resort-300 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 text-sm">{w.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{w.description}</p>
                    <p className="text-xs text-gray-400 italic mb-3">{w.preview}</p>
                    <div className="relative bg-gray-950 rounded p-3 pr-10">
                      <code className="text-green-400 text-xs font-mono break-all whitespace-pre-wrap">{w.snippet}</code>
                      <button
                        onClick={() => copy(w.snippet, w.key)}
                        className="absolute top-2 right-2 p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                        title="Copy snippet"
                      >
                        {copied === w.key
                          ? <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                          : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Optional customization */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Palette className="h-4 w-4 text-resort-600" />
            Optional customization
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            You can override colors and currency per widget using HTML attributes.
          </p>
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 font-medium text-gray-700">Attribute</th>
                  <th className="pb-2 pr-4 font-medium text-gray-700">Example</th>
                  <th className="pb-2 font-medium text-gray-700">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { attr: 'data-color', ex: '#2563eb', desc: 'Override primary brand color' },
                  { attr: 'data-currency', ex: 'USD', desc: 'Override currency code' },
                  { attr: 'data-whatsapp', ex: '+8801700000000', desc: 'WhatsApp number (CTA widget only)' },
                ].map(row => (
                  <tr key={row.attr}>
                    <td className="py-2 pr-4">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-resort-700">{row.attr}</code>
                    </td>
                    <td className="py-2 pr-4 text-gray-600 text-xs font-mono">{row.ex}</td>
                    <td className="py-2 text-gray-500 text-xs">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* JS API */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-medium text-blue-800 mb-1">JavaScript API (advanced)</p>
            <code className="text-xs text-blue-700 block font-mono">
              {`// Mount programmatically\nResortPro.mount(document.getElementById('my-div'), 'booking', '${slug}')\n\n// Re-scan after dynamically adding HTML\nResortPro.scan()`}
            </code>
          </div>
        </CardContent>
      </Card>

      {/* WordPress Plugin */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Globe className="h-4 w-4 text-resort-600" />
            WordPress Plugin
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Install our plugin for one-click widget placement via shortcodes and Gutenberg blocks.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-700 mb-1">Manual install (.zip)</p>
              <p className="text-xs text-gray-500 mb-3">Download and upload via WordPress admin → Plugins → Add New → Upload Plugin</p>
              <a
                href={wpPluginUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-resort-600 hover:text-resort-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Download Plugin (.zip)
              </a>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-700 mb-1">Available shortcodes</p>
              <div className="space-y-1 mt-2">
                {[
                  `[resortpro_booking slug="${slug}"]`,
                  `[resortpro_rooms slug="${slug}"]`,
                  `[resortpro_calendar slug="${slug}"]`,
                  `[resortpro_menu slug="${slug}"]`,
                  `[resortpro_cta slug="${slug}"]`,
                ].map(sc => (
                  <div key={sc} className="flex items-center justify-between gap-2">
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 flex-1 truncate">{sc}</code>
                    <button
                      onClick={() => copy(sc, sc)}
                      className="shrink-0 p-1 text-gray-400 hover:text-gray-700"
                    >
                      {copied === sc ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


// ── Modules Tab ───────────────────────────────────────────────────────────────

function ModulesTab() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-modules'],
    queryFn: () => tenantApi.getModules(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ flag, enabled }: { flag: string; enabled: boolean }) =>
      tenantApi.toggleModule(flag, enabled),
    onSuccess: (_res, { enabled }) => {
      qc.invalidateQueries({ queryKey: ['tenant-modules'] });
      toast({ title: enabled ? 'Module enabled' : 'Module disabled' });
    },
    onError: () => toast({ title: 'Failed to update module', variant: 'destructive' }),
  });

  type Module = { flag: string; label: string; description: string; enabled: boolean };
  const modules: Module[] = data?.data?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Modules</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Turn off modules your resort doesn't use — they'll be hidden from the sidebar for all staff.
        </p>
      </div>

      <Card>
        <CardContent className="divide-y divide-gray-100 p-0">
          {modules.map((mod) => {
            const isPending = toggleMutation.isPending && toggleMutation.variables?.flag === mod.flag;
            return (
              <div key={mod.flag} className="flex items-center justify-between px-5 py-4">
                <div className="min-w-0 pr-6">
                  <p className="text-sm font-medium text-gray-900">{mod.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{mod.description}</p>
                </div>
                <button
                  disabled={isPending}
                  onClick={() => toggleMutation.mutate({ flag: mod.flag, enabled: !mod.enabled })}
                  className="shrink-0 disabled:opacity-50"
                  aria-label={mod.enabled ? `Disable ${mod.label}` : `Enable ${mod.label}`}
                >
                  {mod.enabled ? (
                    <ToggleRight className="h-8 w-8 text-resort-600" />
                  ) : (
                    <ToggleLeft className="h-8 w-8 text-gray-300" />
                  )}
                </button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Room Type Names */}
      <RoomTypeSettings />
    </div>
  );
}

// ── SMS & WhatsApp Notifications Tab ─────────────────────────────────────────

function NotificationsTab() {
  const qc = useQueryClient();
  const [activeSection, setActiveSection] = useState<'sms' | 'wa' | 'triggers'>('sms');
  const [testPhone, setTestPhone] = useState('');
  const [testWaPhone, setTestWaPhone] = useState('');
  const [showSmsKey, setShowSmsKey] = useState(false);
  const [showWaToken, setShowWaToken] = useState(false);

  // SMS credentials form
  const [smsMode, setSmsMode] = useState<'platform' | 'own'>('platform');
  const [smsProvider, setSmsProvider] = useState('ssl_wireless');
  const [smsApiKey, setSmsApiKey] = useState('');
  const [smsApiSecret, setSmsApiSecret] = useState('');
  const [smsSenderId, setSmsSenderId] = useState('');

  // WhatsApp credentials form
  const [waMode, setWaMode] = useState<'platform' | 'own'>('platform');
  const [waPhoneNumberId, setWaPhoneNumberId] = useState('');
  const [waApiToken, setWaApiToken] = useState('');
  const [waBusinessAccId, setWaBusinessAccId] = useState('');

  // Trigger toggles
  const [triggers, setTriggers] = useState({
    smsEnabled: false, waEnabled: false,
    notifBookingConfirm: true, notifPaymentReceived: true,
    notifCheckinReminder: true, notifCheckoutRemind: false,
    notifCancellation: true, notifInvoiceSent: false,
    notifLanguage: 'en',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['sms-settings'],
    queryFn: () => tenantApi.getSmsSettings(),
  });

  useEffect(() => {
    if (!data?.data?.data) return;
    const d = data.data.data;
    setSmsMode(d.smsMode || 'platform');
    setSmsProvider(d.smsProvider || 'ssl_wireless');
    setSmsApiKey(d.smsApiKey || '');
    setSmsApiSecret(d.smsApiSecret || '');
    setSmsSenderId(d.smsSenderId || '');
    setWaMode(d.waMode || 'platform');
    setWaPhoneNumberId(d.waPhoneNumberId || '');
    setWaApiToken(d.waApiToken || '');
    setWaBusinessAccId(d.waBusinessAccId || '');
    setTriggers({
      smsEnabled: d.smsEnabled ?? false,
      waEnabled: d.waEnabled ?? false,
      notifBookingConfirm: d.notifBookingConfirm ?? true,
      notifPaymentReceived: d.notifPaymentReceived ?? true,
      notifCheckinReminder: d.notifCheckinReminder ?? true,
      notifCheckoutRemind: d.notifCheckoutRemind ?? false,
      notifCancellation: d.notifCancellation ?? true,
      notifInvoiceSent: d.notifInvoiceSent ?? false,
      notifLanguage: d.notifLanguage || 'en',
    });
  }, [data]);

  const smsMut = useMutation({
    mutationFn: () => tenantApi.saveSmsCredentials({ smsMode, smsProvider, smsApiKey, smsApiSecret, smsSenderId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sms-settings'] }); toast({ title: '✓ SMS credentials saved' }); },
    onError: () => toast({ title: 'Error', variant: 'destructive', description: 'Could not save SMS credentials' }),
  });

  const waMut = useMutation({
    mutationFn: () => tenantApi.saveWaCredentials({ waMode, waPhoneNumberId, waApiToken, waBusinessAccId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sms-settings'] }); toast({ title: '✓ WhatsApp credentials saved' }); },
    onError: () => toast({ title: 'Error', variant: 'destructive', description: 'Could not save WhatsApp credentials' }),
  });

  const triggerMut = useMutation({
    mutationFn: (payload?: typeof triggers) => tenantApi.updateSmsSettings(payload ?? triggers),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sms-settings'] }); toast({ title: '✓ Notification settings saved' }); },
    onError: () => toast({ title: 'Error', variant: 'destructive' }),
  });

  const testSmsMut = useMutation({
    mutationFn: () => tenantApi.testSms(testPhone),
    onSuccess: () => toast({ title: '✓ Test SMS sent', description: `Sent to ${testPhone}` }),
    onError: () => toast({ title: 'Failed', variant: 'destructive' }),
  });

  const testWaMut = useMutation({
    mutationFn: () => tenantApi.testWhatsapp(testWaPhone),
    onSuccess: () => toast({ title: '✓ Test WhatsApp sent', description: `Sent to ${testWaPhone}` }),
    onError: () => toast({ title: 'Failed', variant: 'destructive' }),
  });

  const d = data?.data?.data;
  const smsPct = d && d.smsQuotaMonthly > 0 ? Math.min(100, Math.round((d.smsUsedThisMonth / d.smsQuotaMonthly) * 100)) : 0;
  const waPct  = d && d.waQuotaMonthly  > 0 ? Math.min(100, Math.round((d.waUsedThisMonth  / d.waQuotaMonthly)  * 100)) : 0;

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-resort-600" />
    </div>
  );

  const SECTIONS = [
    { id: 'sms',      label: 'SMS',       icon: Phone },
    { id: 'wa',       label: 'WhatsApp',  icon: Send },
    { id: 'triggers', label: 'Triggers',  icon: Bell },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Section tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveSection(id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === id ? 'bg-white text-resort-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── SMS Section ──────────────────────────────────────────────────────── */}
      {activeSection === 'sms' && (
        <div className="space-y-4">
          {/* Enable toggle */}
          <div className="bg-white rounded-2xl border p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">SMS Notifications</p>
              <p className="text-sm text-gray-500 mt-0.5">Booking confirmations, payment receipts, check-in reminders via SMS</p>
            </div>
            <button onClick={() => {
                const newTriggers = { ...triggers, smsEnabled: !triggers.smsEnabled };
                setTriggers(newTriggers);
                triggerMut.mutate(newTriggers);
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${triggers.smsEnabled ? 'bg-resort-600' : 'bg-gray-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${triggers.smsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Usage bar */}
          <div className="bg-white rounded-2xl border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-800">Usage This Month</p>
              <span className="text-sm text-gray-500">{d?.smsUsedThisMonth ?? 0} / {d?.smsQuotaMonthly ?? 100} SMS</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${smsPct >= 90 ? 'bg-red-500' : smsPct >= 70 ? 'bg-amber-500' : 'bg-resort-500'}`}
                style={{ width: `${smsPct}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Extra credits: <strong className="text-gray-800">{d?.smsCredits ?? 0}</strong></span>
              <a href="/dashboard/billing" className="text-resort-600 hover:underline font-medium">Buy Credits →</a>
            </div>
          </div>

          {/* Provider mode */}
          <div className="bg-white rounded-2xl border p-5 space-y-4">
            <p className="font-semibold text-gray-800">SMS Provider</p>
            <div className="space-y-2">
              {[
                { val: 'platform', label: 'ResortPro Platform (included in plan)', desc: 'আমরা পাঠাই — কোনো setup লাগবে না' },
                { val: 'own', label: 'Use my own SMS gateway credentials', desc: 'নিজের SSL Wireless / Twilio account ব্যবহার করো' },
              ].map(opt => (
                <label key={opt.val} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${smsMode === opt.val ? 'border-resort-500 bg-resort-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" className="mt-0.5 accent-resort-600" checked={smsMode === opt.val} onChange={() => setSmsMode(opt.val as any)} />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* BYOC fields */}
            {smsMode === 'own' && (
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Provider</label>
                  <select value={smsProvider} onChange={e => setSmsProvider(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-resort-500">
                    <option value="ssl_wireless">SSL Wireless (Bangladesh)</option>
                    <option value="alpha_net">Alpha.Net (Bangladesh)</option>
                    <option value="twilio">Twilio (International)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">API Key</label>
                    <div className="relative">
                      <Input type={showSmsKey ? 'text' : 'password'} value={smsApiKey} onChange={e => setSmsApiKey(e.target.value)} placeholder="Your API key" />
                      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowSmsKey(v => !v)}>
                        {showSmsKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {smsProvider === 'twilio' && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Auth Token</label>
                      <Input type="password" value={smsApiSecret} onChange={e => setSmsApiSecret(e.target.value)} placeholder="Auth token" />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Sender ID <span className="text-gray-400 text-xs">(max 11 chars)</span></label>
                  <Input value={smsSenderId} onChange={e => setSmsSenderId(e.target.value.slice(0, 11))} placeholder="e.g. RESORT" maxLength={11} />
                  <p className="text-xs text-gray-400">This name appears as the sender on guest's phone</p>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => smsMut.mutate()} loading={smsMut.isPending} size="sm" className="gap-2">
                <Save className="h-3.5 w-3.5" /> Save SMS Settings
              </Button>
            </div>
          </div>

          {/* Test SMS */}
          <div className="bg-white rounded-2xl border p-5 space-y-3">
            <p className="font-semibold text-gray-800">Send Test SMS</p>
            <div className="flex gap-2">
              <Input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+8801XXXXXXXXX" className="flex-1" />
              <Button onClick={() => testSmsMut.mutate()} loading={testSmsMut.isPending} disabled={!testPhone} variant="outline" className="gap-2 shrink-0">
                <Send className="h-3.5 w-3.5" /> Send Test
              </Button>
            </div>
            <p className="text-xs text-gray-400">Include country code. e.g. +8801712345678</p>
          </div>
        </div>
      )}

      {/* ── WhatsApp Section ─────────────────────────────────────────────────── */}
      {activeSection === 'wa' && (
        <div className="space-y-4">
          {/* Enable toggle */}
          <div className="bg-white rounded-2xl border p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">WhatsApp Notifications</p>
              <p className="text-sm text-gray-500 mt-0.5">Booking confirmations, invoices, reminders via WhatsApp</p>
            </div>
            <button onClick={() => { const newTriggers = { ...triggers, waEnabled: !triggers.waEnabled }; setTriggers(newTriggers); triggerMut.mutate(newTriggers); }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${triggers.waEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${triggers.waEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Usage bar */}
          <div className="bg-white rounded-2xl border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-800">Usage This Month</p>
              <span className="text-sm text-gray-500">{d?.waUsedThisMonth ?? 0} / {d?.waQuotaMonthly ?? 50} conversations</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${waPct >= 90 ? 'bg-red-500' : waPct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${waPct}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Extra credits: <strong className="text-gray-800">{d?.waCredits ?? 0}</strong></span>
              <a href="/dashboard/billing" className="text-resort-600 hover:underline font-medium">Buy Credits →</a>
            </div>
          </div>

          {/* Provider mode */}
          <div className="bg-white rounded-2xl border p-5 space-y-4">
            <p className="font-semibold text-gray-800">WhatsApp Provider</p>
            <div className="space-y-2">
              {[
                { val: 'platform', label: 'ResortPro Platform (included in plan)', desc: 'আমরা পাঠাই — কোনো Meta account লাগবে না' },
                { val: 'own', label: 'Use my own Meta Business account', desc: 'নিজের WhatsApp Business number ব্যবহার করো' },
              ].map(opt => (
                <label key={opt.val} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${waMode === opt.val ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" className="mt-0.5 accent-green-600" checked={waMode === opt.val} onChange={() => setWaMode(opt.val as any)} />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* BYOC fields */}
            {waMode === 'own' && (
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5 text-xs text-blue-700">
                  <strong>How to get these:</strong> Meta Business Manager → WhatsApp → API Setup
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Phone Number ID</label>
                  <Input value={waPhoneNumberId} onChange={e => setWaPhoneNumberId(e.target.value)} placeholder="e.g. 123456789012345" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Business Account ID</label>
                  <Input value={waBusinessAccId} onChange={e => setWaBusinessAccId(e.target.value)} placeholder="e.g. 987654321098765" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">API Token (Permanent)</label>
                  <div className="relative">
                    <Input type={showWaToken ? 'text' : 'password'} value={waApiToken} onChange={e => setWaApiToken(e.target.value)} placeholder="EAAxxxxx..." />
                    <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowWaToken(v => !v)}>
                      {showWaToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">Generate a permanent token from Meta Business Manager</p>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => waMut.mutate()} loading={waMut.isPending} size="sm" className="gap-2 bg-green-600 hover:bg-green-700">
                <Save className="h-3.5 w-3.5" /> Save WhatsApp Settings
              </Button>
            </div>
          </div>

          {/* Test WhatsApp */}
          <div className="bg-white rounded-2xl border p-5 space-y-3">
            <p className="font-semibold text-gray-800">Send Test WhatsApp</p>
            <div className="flex gap-2">
              <Input value={testWaPhone} onChange={e => setTestWaPhone(e.target.value)} placeholder="+8801XXXXXXXXX" className="flex-1" />
              <Button onClick={() => testWaMut.mutate()} loading={testWaMut.isPending} disabled={!testWaPhone}
                className="gap-2 shrink-0 bg-green-600 hover:bg-green-700">
                <Send className="h-3.5 w-3.5" /> Send Test
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Triggers Section ─────────────────────────────────────────────────── */}
      {activeSection === 'triggers' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="px-5 py-4 border-b bg-gray-50">
              <p className="font-semibold text-gray-800">Notification Triggers</p>
              <p className="text-xs text-gray-500 mt-0.5">কোন ঘটনায় guest-কে SMS/WhatsApp পাঠাবে</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Event</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">SMS</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  { key: 'notifBookingConfirm',   label: 'Booking Confirmed',          emoji: '📋' },
                  { key: 'notifPaymentReceived',   label: 'Payment Received',           emoji: '💰' },
                  { key: 'notifCheckinReminder',   label: 'Check-in Reminder (1 day)',  emoji: '📅' },
                  { key: 'notifCheckoutRemind',    label: 'Check-out Reminder',         emoji: '🛎️' },
                  { key: 'notifCancellation',      label: 'Booking Cancelled',          emoji: '❌' },
                  { key: 'notifInvoiceSent',       label: 'Invoice Sent',              emoji: '🧾' },
                ].map(({ key, label, emoji }) => (
                  <tr key={key} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-medium text-gray-700">{emoji} {label}</td>
                    <td className="px-4 py-3.5 text-center">
                      <input type="checkbox"
                        checked={!!triggers[key as keyof typeof triggers]}
                        onChange={e => setTriggers(p => ({ ...p, [key]: e.target.checked }))}
                        className="h-4 w-4 rounded accent-resort-600" />
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <input type="checkbox"
                        checked={!!triggers[key as keyof typeof triggers]}
                        onChange={e => setTriggers(p => ({ ...p, [key]: e.target.checked }))}
                        className="h-4 w-4 rounded accent-green-600" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Language */}
          <div className="bg-white rounded-2xl border p-5 space-y-3">
            <p className="font-semibold text-gray-800">Message Language</p>
            <div className="flex gap-3">
              {[
                { val: 'en', label: '🇬🇧 English' },
                { val: 'bn', label: '🇧🇩 বাংলা' },
                { val: 'both', label: '🌐 Both' },
              ].map(opt => (
                <label key={opt.val} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-colors text-sm font-medium ${
                  triggers.notifLanguage === opt.val ? 'border-resort-500 bg-resort-50 text-resort-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                  <input type="radio" className="sr-only" checked={triggers.notifLanguage === opt.val} onChange={() => setTriggers(p => ({ ...p, notifLanguage: opt.val }))} />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => triggerMut.mutate(triggers)} loading={triggerMut.isPending} className="gap-2">
              <Save className="h-4 w-4" /> Save Trigger Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Discovery Map Tab ──────────────────────────────────────────────────────────

function DiscoveryMapTab() {
  const { tenant } = useAuthStore();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    mapVisible:           false,
    latitude:             '',
    longitude:            '',
    resortCategory:       '',
    priceFrom:            '',
    shortDescription:     '',
    coverImageUrl:        '',
    // Revenue / premium fields
    affiliateUrl:         '',
    affiliateSource:      '',
    bookingPhone:         '',
    instagramHandle:      '',
    galleryImages:        '' as string,    // newline-separated URLs
    amenitiesHighlights:  '' as string,    // newline-separated items
  });

  // New gallery image input
  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const [newAmenity,    setNewAmenity]    = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['discovery-settings'],
    queryFn:  () => api.get('/discovery/admin/settings').then(r => r.data.data),
    enabled:  !!tenant,
  });

  useEffect(() => {
    if (data) {
      setForm({
        mapVisible:           data.mapVisible         ?? false,
        latitude:             data.latitude           != null ? String(data.latitude)  : '',
        longitude:            data.longitude          != null ? String(data.longitude) : '',
        resortCategory:       data.resortCategory     ?? '',
        priceFrom:            data.priceFrom          != null ? String(data.priceFrom) : '',
        shortDescription:     data.shortDescription   ?? '',
        coverImageUrl:        data.coverImageUrl      ?? '',
        affiliateUrl:         data.affiliateUrl       ?? '',
        affiliateSource:      data.affiliateSource    ?? '',
        bookingPhone:         data.bookingPhone       ?? '',
        instagramHandle:      data.instagramHandle    ?? '',
        galleryImages:        (data.galleryImages      ?? []).join('\n'),
        amenitiesHighlights:  (data.amenitiesHighlights ?? []).join('\n'),
      });
    }
  }, [data]);

  const galleryArr    = form.galleryImages.split('\n').map(s => s.trim()).filter(Boolean);
  const amenitiesArr  = form.amenitiesHighlights.split('\n').map(s => s.trim()).filter(Boolean);

  const addGallery = () => {
    if (!newGalleryUrl.trim()) return;
    setForm(f => ({ ...f, galleryImages: [...galleryArr, newGalleryUrl.trim()].join('\n') }));
    setNewGalleryUrl('');
  };
  const removeGallery = (url: string) => {
    setForm(f => ({ ...f, galleryImages: galleryArr.filter(u => u !== url).join('\n') }));
  };

  const addAmenity = () => {
    if (!newAmenity.trim()) return;
    setForm(f => ({ ...f, amenitiesHighlights: [...amenitiesArr, newAmenity.trim()].join('\n') }));
    setNewAmenity('');
  };
  const removeAmenity = (item: string) => {
    setForm(f => ({ ...f, amenitiesHighlights: amenitiesArr.filter(a => a !== item).join('\n') }));
  };

  const saveMut = useMutation({
    mutationFn: () => api.patch('/discovery/admin/settings', {
      mapVisible:           form.mapVisible,
      latitude:             form.latitude             ? parseFloat(form.latitude)  : null,
      longitude:            form.longitude            ? parseFloat(form.longitude) : null,
      resortCategory:       form.resortCategory       || null,
      priceFrom:            form.priceFrom            ? parseFloat(form.priceFrom) : null,
      shortDescription:     form.shortDescription     || null,
      coverImageUrl:        form.coverImageUrl        || null,
      affiliateUrl:         form.affiliateUrl         || null,
      affiliateSource:      form.affiliateSource      || null,
      bookingPhone:         form.bookingPhone         || null,
      instagramHandle:      form.instagramHandle      || null,
      galleryImages:        galleryArr,
      amenitiesHighlights:  amenitiesArr,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovery-settings'] });
      toast({ title: 'Discovery settings saved!', description: 'Your resort will appear on the map.' });
    },
    onError: () => toast({ title: 'Save failed', variant: 'destructive' }),
  });

  const CATEGORIES = [
    { value: 'eco',      label: '🌿 Eco Resort' },
    { value: 'agro',     label: '🌾 Agro Resort' },
    { value: 'beach',    label: '🏖️ Beach Resort' },
    { value: 'hill',     label: '⛰️ Hill Resort' },
    { value: 'city',     label: '🏙️ City Hotel' },
    { value: 'heritage', label: '🏛️ Heritage Property' },
    { value: 'resort',   label: '🏨 Resort' },
  ];

  const AFFILIATE_SOURCES = [
    { value: 'booking.com', label: 'Booking.com' },
    { value: 'agoda',       label: 'Agoda' },
    { value: 'direct',      label: 'Direct (own booking page)' },
    { value: 'custom',      label: 'Custom / Other' },
  ];

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#183153]" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-[#183153] to-[#122846] text-white p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base">stay.resortpro.site</h2>
            <p className="text-xs text-white/70">Public resort discovery map</p>
          </div>
        </div>
        <p className="text-sm text-white/80">
          Enable your resort on the public discovery map so travelers can find you.
        </p>
        {form.mapVisible && (
          <a
            href={`https://stay.resortpro.site/resort/${tenant?.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors">
            <ExternalLink className="w-3 h-3" /> View on discovery map →
          </a>
        )}
      </div>

      {/* Visibility toggle */}
      <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl">
        <div>
          <p className="font-medium text-gray-800">Show on Discovery Map</p>
          <p className="text-xs text-gray-500 mt-0.5">Make your resort visible to travelers on stay.resortpro.site</p>
        </div>
        <button
          onClick={() => setForm(f => ({ ...f, mapVisible: !f.mapVisible }))}
          className={`flex items-center gap-2 text-sm font-semibold transition-colors ${
            form.mapVisible ? 'text-[#183153]' : 'text-gray-400'
          }`}>
          {form.mapVisible
            ? <ToggleRight className="w-8 h-8 text-[#183153]" />
            : <ToggleLeft  className="w-8 h-8 text-gray-300" />}
        </button>
      </div>

      {form.mapVisible && (
        <>
          {/* Location */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#183153]" /> Map Location
              </h3>
              <p className="text-xs text-gray-400">
                Get your coordinates from{' '}
                <a href="https://www.latlong.net" target="_blank" rel="noopener noreferrer" className="text-[#183153] underline">
                  latlong.net
                </a>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Latitude</label>
                  <Input
                    placeholder="e.g. 22.3569"
                    value={form.latitude}
                    onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Longitude</label>
                  <Input
                    placeholder="e.g. 91.7832"
                    value={form.longitude}
                    onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resort info */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <h3 className="font-semibold text-gray-700">Resort Information</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Category</label>
                  <select
                    value={form.resortCategory}
                    onChange={e => setForm(f => ({ ...f, resortCategory: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#183153]/30">
                    <option value="">Select category</option>
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Starting Price / Night</label>
                  <Input
                    placeholder="e.g. 5000"
                    value={form.priceFrom}
                    onChange={e => setForm(f => ({ ...f, priceFrom: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Short Description (1-2 lines)</label>
                <textarea
                  rows={2}
                  placeholder="A peaceful eco resort nestled in the hills of Bandarban..."
                  value={form.shortDescription}
                  onChange={e => setForm(f => ({ ...f, shortDescription: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#183153]/30"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Cover Image URL</label>
                <Input
                  placeholder="https://..."
                  value={form.coverImageUrl}
                  onChange={e => setForm(f => ({ ...f, coverImageUrl: e.target.value }))}
                />
                {form.coverImageUrl && (
                  <img
                    src={form.coverImageUrl}
                    alt="Preview"
                    className="mt-2 h-28 w-full object-cover rounded-lg border border-gray-100"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Booking & Contact */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                📞 Booking & Contact
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Booking Phone / WhatsApp</label>
                  <Input
                    placeholder="+880 1XXX-XXXXXX"
                    value={form.bookingPhone}
                    onChange={e => setForm(f => ({ ...f, bookingPhone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Instagram Handle</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                    <Input
                      className="pl-7"
                      placeholder="yourresort"
                      value={form.instagramHandle}
                      onChange={e => setForm(f => ({ ...f, instagramHandle: e.target.value.replace('@', '') }))}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Affiliate Booking Link */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                    🔗 Affiliate / Booking Link
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    When travelers click "Book", they'll be sent here. We track the click.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Booking Source</label>
                  <select
                    value={form.affiliateSource}
                    onChange={e => setForm(f => ({ ...f, affiliateSource: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#183153]/30">
                    <option value="">Select source</option>
                    {AFFILIATE_SOURCES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Booking URL</label>
                  <Input
                    placeholder="https://booking.com/hotel/..."
                    value={form.affiliateUrl}
                    onChange={e => setForm(f => ({ ...f, affiliateUrl: e.target.value }))}
                  />
                </div>
              </div>

              {form.affiliateUrl && (
                <div className="flex items-center gap-2 p-2.5 bg-[#f2f7fb] rounded-lg text-xs text-[#183153]">
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">Travelers will be sent to: <strong>{form.affiliateUrl}</strong></span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gallery Images */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  🖼️ Gallery Images
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Add photo URLs to showcase on your premium profile (up to 8 images).
                </p>
              </div>

              {/* Existing gallery */}
              {galleryArr.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {galleryArr.map((url, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={url}
                        alt={`Gallery ${i + 1}`}
                        className="w-full aspect-square object-cover rounded-lg border border-gray-100"
                        onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                      />
                      <button
                        onClick={() => removeGallery(url)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new */}
              {galleryArr.length < 8 && (
                <div className="flex gap-2">
                  <Input
                    placeholder="https://... (image URL)"
                    value={newGalleryUrl}
                    onChange={e => setNewGalleryUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addGallery()}
                    className="flex-1"
                  />
                  <Button variant="outline" size="sm" onClick={addGallery} className="flex-shrink-0">
                    Add
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Amenities */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  ✨ Amenity Highlights
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Key features shown as chips on your profile (e.g. "Swimming Pool", "Free WiFi").
                </p>
              </div>

              {/* Existing amenities */}
              {amenitiesArr.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {amenitiesArr.map((item, i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-[#f2f7fb] border border-[#d4e4ef] text-[#183153] text-xs font-medium px-2.5 py-1 rounded-full">
                      {item}
                      <button onClick={() => removeAmenity(item)} className="ml-0.5 hover:text-red-500 transition-colors">×</button>
                    </span>
                  ))}
                </div>
              )}

              {amenitiesArr.length < 12 && (
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Swimming Pool, Free WiFi, Restaurant…"
                    value={newAmenity}
                    onChange={e => setNewAmenity(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addAmenity()}
                    className="flex-1"
                  />
                  <Button variant="outline" size="sm" onClick={addAmenity} className="flex-shrink-0">
                    Add
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Save */}
      <div className="flex justify-end pt-2">
        <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending} className="gap-2 px-8">
          <Save className="h-4 w-4" /> Save Discovery Settings
        </Button>
      </div>
    </div>
  );
}
