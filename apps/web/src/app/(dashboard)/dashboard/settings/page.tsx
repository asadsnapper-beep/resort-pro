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
  ExternalLink, CheckCircle, XCircle, AlertTriangle, Copy, RefreshCw, Trash2, ShieldCheck, Star,
  FileText, Palette, Lock, CheckCircle2, Circle, Loader2, Shield, Send, ToggleLeft, ToggleRight,
  CreditCard, Eye, EyeOff, ChevronDown, ChevronRight,
} from 'lucide-react'
import { paymentGatewayApi } from '@/lib/api';

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
  { id: 'general',    label: 'General',           icon: Building2 },
  { id: 'contact',    label: 'Contact',            icon: Phone },
  { id: 'operations', label: 'Operations',         icon: Clock },
  { id: 'email',      label: 'Email',              icon: Mail },
  { id: 'payments',   label: 'Payment Gateways',   icon: CreditCard },
  { id: 'embed',     label: 'Embed & Widget',     icon: ExternalLink },
  { id: 'domain',     label: 'Custom Domain',      icon: Globe },
  { id: 'gdpr',       label: 'Privacy & GDPR',     icon: ShieldCheck },
  { id: 'enterprise', label: 'Enterprise',         icon: Star },
] as const;

type Tab = typeof TABS[number]['id'];

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

      {tab !== 'domain' && tab !== 'gdpr' && tab !== 'enterprise' && tab !== 'payments' && tab !== 'embed' && (
        <div className="flex justify-end pt-2">
          <Button className="gap-2 px-8" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            <Save className="h-4 w-4" /> Save All Changes
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Payment Gateways Tab ──────────────────────────────────────────────────

function PaymentGatewaysTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // bKash
  const [bkashEnabled, setBkashEnabled]     = useState(false)
  const [bkashAppKey, setBkashAppKey]       = useState('')
  const [bkashAppSecret, setBkashAppSecret] = useState('')
  const [bkashUsername, setBkashUsername]   = useState('')
  const [bkashPassword, setBkashPassword]   = useState('')
  const [showBkashSecret, setShowBkashSecret] = useState(false)
  const [showBkashPass, setShowBkashPass]     = useState(false)
  const [bkashOpen, setBkashOpen]             = useState(true)

  // SSL Commerce
  const [sslEnabled, setSslEnabled]         = useState(false)
  const [sslStoreId, setSslStoreId]         = useState('')
  const [sslStorePassword, setSslStorePassword] = useState('')
  const [sslIsLive, setSslIsLive]           = useState(false)
  const [showSslPass, setShowSslPass]       = useState(false)
  const [sslOpen, setSslOpen]               = useState(true)

  // Stripe
  const [stripeEnabled, setStripeEnabled]   = useState(false)
  const [stripeOpen, setStripeOpen]         = useState(true)

  useEffect(() => {
    paymentGatewayApi.getSettings()
      .then((r: any) => {
        const d = r.data.data
        setBkashEnabled(d.bkash?.enabled ?? false)
        setBkashAppKey(d.bkash?.appKey ?? '')
        setBkashUsername(d.bkash?.username ?? '')
        setSslEnabled(d.ssl?.enabled ?? false)
        setSslStoreId(d.ssl?.storeId ?? '')
        setSslIsLive(d.ssl?.isLive ?? false)
        setStripeEnabled(d.stripe?.enabled ?? false)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (section: 'bkash' | 'ssl' | 'stripe') => {
    setSaving(true)
    try {
      const payload: any = {}
      if (section === 'bkash') {
        payload.bkash = {
          enabled: bkashEnabled,
          ...(bkashAppKey    && { appKey:    bkashAppKey }),
          ...(bkashAppSecret && { appSecret: bkashAppSecret }),
          ...(bkashUsername  && { username:  bkashUsername }),
          ...(bkashPassword  && { password:  bkashPassword }),
        }
      } else if (section === 'ssl') {
        payload.ssl = {
          enabled: sslEnabled,
          ...(sslStoreId       && { storeId:       sslStoreId }),
          ...(sslStorePassword && { storePassword: sslStorePassword }),
          isLive: sslIsLive,
        }
      } else {
        payload.stripe = { enabled: stripeEnabled }
      }
      await paymentGatewayApi.saveSettings(payload)
      // Clear password fields after save (security)
      if (section === 'bkash') { setBkashAppSecret(''); setBkashPassword('') }
      if (section === 'ssl')   { setSslStorePassword('') }
      toast({ title: '✅ Saved!' })
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="h-64 rounded-xl bg-gray-100 animate-pulse" />
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3">
        <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          Enable payment gateways to let guests pay online when booking.
          Only enabled gateways appear on your booking page.
          Credentials are stored securely — secrets are never shown again after saving.
        </p>
      </div>

      {/* Manual Payment — always on */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xl">🏨</div>
              <div>
                <p className="font-semibold text-gray-800">Manual Payment</p>
                <p className="text-xs text-gray-500">Guest selects "Pay at Hotel" — booking saved as Pending</p>
              </div>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">Always on</span>
          </div>
        </CardContent>
      </Card>

      {/* bKash */}
      <Card>
        <CardContent className="p-5 space-y-4">
          {/* Header row */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
              <span className="text-lg font-bold text-pink-600">৳</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800">bKash</p>
              <p className="text-xs text-gray-500">Mobile banking — best for Bangladeshi guests</p>
            </div>
            <button
              type="button"
              onClick={() => setBkashEnabled(e => !e)}
              className="flex items-center gap-2"
            >
              {bkashEnabled
                ? <ToggleRight className="h-7 w-7 text-pink-600" />
                : <ToggleLeft  className="h-7 w-7 text-gray-300" />}
            </button>
            <button type="button" onClick={() => setBkashOpen(o => !o)} className="text-gray-400 ml-1">
              {bkashOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          {bkashOpen && (
            <div className="space-y-3 pt-1 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">App Key</label>
                  <Input value={bkashAppKey} onChange={e => setBkashAppKey(e.target.value)} placeholder="Current: ••••{last 4}" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">App Secret</label>
                  <div className="relative">
                    <Input
                      type={showBkashSecret ? 'text' : 'password'}
                      value={bkashAppSecret}
                      onChange={e => setBkashAppSecret(e.target.value)}
                      placeholder="Enter to update"
                      className="pr-9"
                    />
                    <button type="button" onClick={() => setShowBkashSecret(s => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showBkashSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
                  <Input value={bkashUsername} onChange={e => setBkashUsername(e.target.value)} placeholder="bKash username" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                  <div className="relative">
                    <Input
                      type={showBkashPass ? 'text' : 'password'}
                      value={bkashPassword}
                      onChange={e => setBkashPassword(e.target.value)}
                      placeholder="Enter to update"
                      className="pr-9"
                    />
                    <button type="button" onClick={() => setShowBkashPass(s => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showBkashPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Get credentials from{' '}
                <a href="https://developer.bka.sh" target="_blank" rel="noopener noreferrer"
                  className="text-pink-600 underline">developer.bka.sh</a>.
                Leave secret/password blank to keep existing values.
              </p>
              <div className="flex justify-end">
                <Button size="sm" onClick={() => handleSave('bkash')} loading={saving}
                  className="gap-2 bg-pink-600 hover:bg-pink-700 text-white">
                  <Save className="h-3.5 w-3.5" /> Save bKash
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SSL Commerce */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-lg">🔒</div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800">SSL Commerce</p>
              <p className="text-xs text-gray-500">Cards, bKash, Nagad, Rocket, bank transfer</p>
            </div>
            <button
              type="button"
              onClick={() => setSslEnabled(e => !e)}
              className="flex items-center gap-2"
            >
              {sslEnabled
                ? <ToggleRight className="h-7 w-7 text-green-600" />
                : <ToggleLeft  className="h-7 w-7 text-gray-300" />}
            </button>
            <button type="button" onClick={() => setSslOpen(o => !o)} className="text-gray-400 ml-1">
              {sslOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          {sslOpen && (
            <div className="space-y-3 pt-1 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Store ID</label>
                  <Input value={sslStoreId} onChange={e => setSslStoreId(e.target.value)} placeholder="e.g. mystore12345" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Store Password</label>
                  <div className="relative">
                    <Input
                      type={showSslPass ? 'text' : 'password'}
                      value={sslStorePassword}
                      onChange={e => setSslStorePassword(e.target.value)}
                      placeholder="Enter to update"
                      className="pr-9"
                    />
                    <button type="button" onClick={() => setShowSslPass(s => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showSslPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Live / Sandbox toggle */}
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">Live Mode</p>
                  <p className="text-xs text-gray-500">Use sandbox for testing, enable Live Mode for real payments</p>
                </div>
                <button type="button" onClick={() => setSslIsLive(l => !l)}>
                  {sslIsLive
                    ? <ToggleRight className="h-7 w-7 text-green-600" />
                    : <ToggleLeft  className="h-7 w-7 text-gray-300" />}
                </button>
              </div>

              {sslIsLive && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-700">Live mode is on — real payments will be processed</p>
                </div>
              )}

              <p className="text-xs text-gray-400">
                Get credentials from{' '}
                <a href="https://developer.sslcommerz.com" target="_blank" rel="noopener noreferrer"
                  className="text-green-600 underline">developer.sslcommerz.com</a>.
              </p>
              <div className="flex justify-end">
                <Button size="sm" onClick={() => handleSave('ssl')} loading={saving}
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                  <Save className="h-3.5 w-3.5" /> Save SSL Commerce
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stripe */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-lg">💳</div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800">Stripe</p>
              <p className="text-xs text-gray-500">International cards — Visa, Mastercard, Amex</p>
            </div>
            <button
              type="button"
              onClick={() => setStripeEnabled(e => !e)}
              className="flex items-center gap-2"
            >
              {stripeEnabled
                ? <ToggleRight className="h-7 w-7 text-indigo-600" />
                : <ToggleLeft  className="h-7 w-7 text-gray-300" />}
            </button>
            <button type="button" onClick={() => setStripeOpen(o => !o)} className="text-gray-400 ml-1">
              {stripeOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          {stripeOpen && (
            <div className="space-y-3 pt-1 border-t border-gray-100">
              <div className="flex items-start gap-3 rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3">
                <Info className="h-4 w-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-700">
                  Stripe guest payments use your platform Stripe key configured via environment variables.
                  Toggle on to enable the inline card form on your booking page.
                </p>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={() => handleSave('stripe')} loading={saving}
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Save className="h-3.5 w-3.5" /> Save Stripe
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
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
          <a href="mailto:privacy@resortpro.com" className="underline font-medium">privacy@resortpro.com</a>.
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
            Contact <a href="mailto:sales@resortpro.com" className="text-indigo-600 underline">sales@resortpro.com</a> to upgrade.
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
                SSO callback URL: <code className="font-mono">https://app.resortpro.com/auth/sso/callback</code>
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
          Contact <a href="mailto:enterprise@resortpro.com" className="underline font-medium">enterprise@resortpro.com</a> for changes.
        </p>
      </div>
    </div>
  );
}


// ── Embed & Widget Tab ────────────────────────────────────────────────────────

function EmbedTab() {
  const { tenant } = useAuthStore()
  const slug = tenant?.slug || ''
  const cdnBase = 'https://cdn.resortpro.app'
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
