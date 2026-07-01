'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminEndpoints } from '@/lib/admin-api';
import { useAdminStore } from '@/store/admin';
import { toast } from '@/hooks/use-toast';
import {
  Loader2, ArrowLeft, Star, FileText, Palette, Lock,
  CheckCircle2, Circle, Save, Trash2, Building2,
  ToggleLeft, ToggleRight, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface SlaData {
  tier: string;
  uptimePercent: number;
  responseTimeH: number;
  contractStart: string;
  contractEnd: string | null;
  autoRenew: boolean;
  notes: string | null;
  signedBy: string | null;
  signedAt: string | null;
}

interface EnterpriseProfile {
  id: string;
  name: string;
  slug: string;
  plan: string;
  email: string | null;
  whitelabelEnabled: boolean;
  brandLogoUrl: string | null;
  brandPrimaryColor: string | null;
  brandAccentColor: string | null;
  companyDisplayName: string | null;
  ssoEnabled: boolean;
  ssoProvider: string | null;
  ssoClientId: string | null;
  ssoConfig: Record<string, unknown> | null;
  onboardingStep: number;
  onboardingCompletedAt: string | null;
  enterpriseNotes: string | null;
  slaAgreement: SlaData | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ONBOARDING_STEPS = [
  'Account Created',
  'Profile & Branding Complete',
  'SSO Configured',
  'White-label Active',
  'SLA Agreement Signed',
  'Training & Onboarding Done',
  'Go-live ✓',
];

const SSO_PROVIDERS = [
  { value: 'google', label: 'Google Workspace' },
  { value: 'microsoft', label: 'Microsoft Azure AD' },
  { value: 'okta', label: 'Okta' },
  { value: 'saml', label: 'Generic SAML 2.0' },
];

const SLA_TIERS = [
  { value: 'BASIC', label: 'Basic', uptime: 99.0, response: 24, color: 'text-gray-400' },
  { value: 'PROFESSIONAL', label: 'Professional', uptime: 99.5, response: 8, color: 'text-indigo-400' },
  { value: 'ENTERPRISE', label: 'Enterprise', uptime: 99.9, response: 4, color: 'text-amber-400' },
];

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
        <Icon className="w-4 h-4 text-gray-500" />
        <h2 className="text-white font-semibold text-sm">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors';
const selectCls = `${inputCls} appearance-none cursor-pointer`;

// ── Onboarding Checklist ──────────────────────────────────────────────────────

function OnboardingChecklist({
  step, completed, notes, canEdit, onUpdate,
}: {
  step: number; completed: boolean; notes: string | null;
  canEdit: boolean; onUpdate: (data: { step?: number; notes?: string; complete?: boolean }) => void;
}) {
  const [localNotes, setLocalNotes] = useState(notes ?? '');
  const [saving, setSaving] = useState(false);

  const save = async (data: { step?: number; notes?: string; complete?: boolean }) => {
    setSaving(true);
    try { await onUpdate(data); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      {ONBOARDING_STEPS.map((label, idx) => {
        const done = idx < step || completed;
        const isCurrent = idx === step && !completed;
        return (
          <div key={idx} className={cn(
            'flex items-center gap-3 p-3 rounded-xl border transition-colors',
            done ? 'border-emerald-500/20 bg-emerald-500/5' : isCurrent ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-gray-800 bg-gray-800/30'
          )}>
            {done
              ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              : <Circle className={cn('w-4 h-4 shrink-0', isCurrent ? 'text-indigo-400' : 'text-gray-700')} />
            }
            <span className={cn('text-sm flex-1', done ? 'text-emerald-300' : isCurrent ? 'text-white' : 'text-gray-600')}>
              {label}
            </span>
            {canEdit && isCurrent && (
              <button
                onClick={() => save({ step: idx + 1 })}
                disabled={saving}
                className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 px-2 py-1 rounded-lg transition-colors"
              >
                {saving ? '...' : 'Mark done'}
              </button>
            )}
          </div>
        );
      })}

      {canEdit && !completed && step >= 6 && (
        <button
          onClick={() => save({ complete: true })}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Mark as Go-live Complete
        </button>
      )}

      <div className="pt-2 border-t border-gray-800">
        <label className="text-xs text-gray-500 block mb-1.5">Internal notes</label>
        <textarea
          value={localNotes}
          onChange={(e) => setLocalNotes(e.target.value)}
          disabled={!canEdit}
          rows={3}
          placeholder="Add onboarding notes..."
          className={cn(inputCls, 'resize-none')}
        />
        {canEdit && (
          <button
            onClick={() => save({ notes: localNotes })}
            disabled={saving}
            className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save notes
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TenantEnterprisePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { hasRole } = useAdminStore();
  const canEdit = hasRole(['SUPER_ADMIN']);
  const canSupport = hasRole(['SUPER_ADMIN', 'SUPPORT']);

  const [profile, setProfile] = useState<EnterpriseProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [slaForm, setSlaForm] = useState<Partial<SlaData>>({});
  const [wlForm, setWlForm] = useState<Partial<EnterpriseProfile>>({});
  const [ssoForm, setSsoForm] = useState<{ ssoEnabled: boolean; ssoProvider: string; ssoClientId: string; ssoClientSecret: string; ssoTenantId: string }>({
    ssoEnabled: false, ssoProvider: 'google', ssoClientId: '', ssoClientSecret: '', ssoTenantId: '',
  });
  const [saving, setSaving] = useState<string | null>(null);

  const load = () => {
    adminEndpoints.getTenantEnterprise(id)
      .then((r) => {
        const data: EnterpriseProfile = r.data.data;
        setProfile(data);
        // Pre-fill forms
        setSlaForm(data.slaAgreement ?? {
          tier: 'ENTERPRISE', uptimePercent: 99.9, responseTimeH: 4,
          contractStart: new Date().toISOString().slice(0, 10),
          contractEnd: null, autoRenew: true, notes: '', signedBy: '', signedAt: null,
        });
        setWlForm({
          whitelabelEnabled: data.whitelabelEnabled,
          brandLogoUrl: data.brandLogoUrl ?? '',
          brandPrimaryColor: data.brandPrimaryColor ?? '#1a6b5e',
          brandAccentColor: data.brandAccentColor ?? '#d4a853',
          companyDisplayName: data.companyDisplayName ?? '',
        });
        setSsoForm({
          ssoEnabled: data.ssoEnabled,
          ssoProvider: data.ssoProvider ?? 'google',
          ssoClientId: data.ssoClientId ?? '',
          ssoClientSecret: '',
          ssoTenantId: (data.ssoConfig as any)?.tenantId ?? '',
        });
      })
      .catch(() => toast({ title: 'Failed to load enterprise profile', variant: 'destructive' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const saveSla = async () => {
    setSaving('sla');
    try {
      await adminEndpoints.upsertSla(id, {
        tier: slaForm.tier,
        uptimePercent: slaForm.uptimePercent,
        responseTimeH: slaForm.responseTimeH,
        contractStart: slaForm.contractStart?.slice(0, 10),
        contractEnd: slaForm.contractEnd?.slice(0, 10) ?? null,
        autoRenew: slaForm.autoRenew,
        notes: slaForm.notes ?? '',
        signedBy: slaForm.signedBy ?? '',
      });
      toast({ title: 'SLA agreement saved' });
      load();
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.response?.data?.error, variant: 'destructive' });
    } finally { setSaving(null); }
  };

  const deleteSla = async () => {
    if (!confirm('Remove SLA agreement?')) return;
    setSaving('sla-del');
    try {
      await adminEndpoints.deleteSla(id);
      toast({ title: 'SLA removed' });
      load();
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.response?.data?.error, variant: 'destructive' });
    } finally { setSaving(null); }
  };

  const saveWhitelabel = async () => {
    setSaving('wl');
    try {
      await adminEndpoints.updateWhitelabel(id, {
        whitelabelEnabled: wlForm.whitelabelEnabled,
        brandLogoUrl: wlForm.brandLogoUrl || null,
        brandPrimaryColor: wlForm.brandPrimaryColor || null,
        brandAccentColor: wlForm.brandAccentColor || null,
        companyDisplayName: wlForm.companyDisplayName || null,
      });
      toast({ title: 'White-label settings saved' });
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.response?.data?.error, variant: 'destructive' });
    } finally { setSaving(null); }
  };

  const saveSso = async () => {
    setSaving('sso');
    try {
      await adminEndpoints.updateSso(id, {
        ssoEnabled: ssoForm.ssoEnabled,
        ssoProvider: ssoForm.ssoProvider || null,
        ssoClientId: ssoForm.ssoClientId || null,
        ssoClientSecret: ssoForm.ssoClientSecret || null,
        ssoConfig: ssoForm.ssoTenantId ? { tenantId: ssoForm.ssoTenantId } : null,
      });
      toast({ title: 'SSO configuration saved' });
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.response?.data?.error, variant: 'destructive' });
    } finally { setSaving(null); }
  };

  const updateOnboarding = async (data: { step?: number; notes?: string; complete?: boolean }) => {
    try {
      await adminEndpoints.updateOnboarding(id, data);
      toast({ title: 'Onboarding updated' });
      load();
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.response?.data?.error, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-500" />
            <h1 className="text-xl font-bold text-white">{profile.name}</h1>
            <span className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full font-medium">
              {profile.plan}
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-amber-400" />
            Enterprise Settings
          </p>
        </div>
      </div>

      {/* Read-only banner */}
      {!canEdit && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Star className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-amber-300 text-sm">Read-only. SUPER_ADMIN role required to modify enterprise settings.</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── SLA Agreement ── */}
        <Section title="SLA Agreement" icon={FileText}>
          <Field label="SLA Tier">
            <div className="grid grid-cols-3 gap-2">
              {SLA_TIERS.map((t) => (
                <button
                  key={t.value}
                  disabled={!canEdit}
                  onClick={() => setSlaForm((p) => ({ ...p, tier: t.value, uptimePercent: t.uptime, responseTimeH: t.response }))}
                  className={cn(
                    'flex flex-col items-center py-3 rounded-xl border text-xs font-medium transition-colors',
                    slaForm.tier === t.value
                      ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                      : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400',
                    !canEdit && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <span className={cn('text-sm font-bold', t.color)}>{t.uptime}%</span>
                  <span className="mt-0.5">{t.label}</span>
                  <span className="text-gray-600 mt-0.5">{t.response}h SLA</span>
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Uptime %">
              <input type="number" step="0.1" min="90" max="100"
                value={slaForm.uptimePercent ?? ''}
                onChange={(e) => setSlaForm((p) => ({ ...p, uptimePercent: parseFloat(e.target.value) }))}
                disabled={!canEdit} className={inputCls} />
            </Field>
            <Field label="Response time (hours)">
              <input type="number" min="1"
                value={slaForm.responseTimeH ?? ''}
                onChange={(e) => setSlaForm((p) => ({ ...p, responseTimeH: parseInt(e.target.value) }))}
                disabled={!canEdit} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Contract start">
              <input type="date"
                value={slaForm.contractStart?.slice(0, 10) ?? ''}
                onChange={(e) => setSlaForm((p) => ({ ...p, contractStart: e.target.value }))}
                disabled={!canEdit} className={inputCls} />
            </Field>
            <Field label="Contract end (blank = open-ended)">
              <input type="date"
                value={slaForm.contractEnd?.slice(0, 10) ?? ''}
                onChange={(e) => setSlaForm((p) => ({ ...p, contractEnd: e.target.value || null }))}
                disabled={!canEdit} className={inputCls} />
            </Field>
          </div>

          <Field label="Signed by (tenant owner email)">
            <input type="email"
              value={slaForm.signedBy ?? ''}
              onChange={(e) => setSlaForm((p) => ({ ...p, signedBy: e.target.value }))}
              placeholder="owner@resort.com"
              disabled={!canEdit} className={inputCls} />
          </Field>

          <Field label="Internal notes">
            <textarea rows={2}
              value={slaForm.notes ?? ''}
              onChange={(e) => setSlaForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Contract details, custom terms..."
              disabled={!canEdit} className={cn(inputCls, 'resize-none')} />
          </Field>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSlaForm((p) => ({ ...p, autoRenew: !p.autoRenew }))}
              disabled={!canEdit}
              className={cn('shrink-0', !canEdit && 'opacity-50 cursor-not-allowed')}
            >
              {slaForm.autoRenew
                ? <ToggleRight className="w-6 h-6 text-indigo-400" />
                : <ToggleLeft className="w-6 h-6 text-gray-600" />}
            </button>
            <span className="text-xs text-gray-400">Auto-renew contract</span>
          </div>

          {canEdit && (
            <div className="flex gap-2 pt-2 border-t border-gray-800">
              <button
                onClick={saveSla}
                disabled={saving === 'sla'}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving === 'sla' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save SLA
              </button>
              {profile.slaAgreement && (
                <button
                  onClick={deleteSla}
                  disabled={saving === 'sla-del'}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm transition-colors"
                >
                  {saving === 'sla-del' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              )}
            </div>
          )}
        </Section>

        {/* ── White-label ── */}
        <Section title="White-label Branding" icon={Palette}>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-800/50 border border-gray-700">
            <button
              onClick={() => setWlForm((p) => ({ ...p, whitelabelEnabled: !p.whitelabelEnabled }))}
              disabled={!canEdit}
              className={cn(!canEdit && 'opacity-50 cursor-not-allowed')}
            >
              {wlForm.whitelabelEnabled
                ? <ToggleRight className="w-6 h-6 text-indigo-400" />
                : <ToggleLeft className="w-6 h-6 text-gray-600" />}
            </button>
            <div>
              <p className="text-sm font-medium text-white">White-label enabled</p>
              <p className="text-xs text-gray-600">Replaces ResortPro branding with tenant's own</p>
            </div>
          </div>

          <Field label="Company display name">
            <input type="text"
              value={wlForm.companyDisplayName ?? ''}
              onChange={(e) => setWlForm((p) => ({ ...p, companyDisplayName: e.target.value }))}
              placeholder="Sunset Resorts"
              disabled={!canEdit} className={inputCls} />
          </Field>

          <Field label="Brand logo URL">
            <input type="url"
              value={wlForm.brandLogoUrl ?? ''}
              onChange={(e) => setWlForm((p) => ({ ...p, brandLogoUrl: e.target.value }))}
              placeholder="https://cdn.resort.com/logo.svg"
              disabled={!canEdit} className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary color">
              <div className="flex gap-2">
                <input type="color"
                  value={wlForm.brandPrimaryColor ?? '#1a6b5e'}
                  onChange={(e) => setWlForm((p) => ({ ...p, brandPrimaryColor: e.target.value }))}
                  disabled={!canEdit}
                  className="w-10 h-10 rounded-lg border border-gray-700 bg-gray-800 cursor-pointer disabled:opacity-50" />
                <input type="text"
                  value={wlForm.brandPrimaryColor ?? ''}
                  onChange={(e) => setWlForm((p) => ({ ...p, brandPrimaryColor: e.target.value }))}
                  placeholder="#1a6b5e"
                  disabled={!canEdit} className={cn(inputCls, 'flex-1')} />
              </div>
            </Field>
            <Field label="Accent color">
              <div className="flex gap-2">
                <input type="color"
                  value={wlForm.brandAccentColor ?? '#d4a853'}
                  onChange={(e) => setWlForm((p) => ({ ...p, brandAccentColor: e.target.value }))}
                  disabled={!canEdit}
                  className="w-10 h-10 rounded-lg border border-gray-700 bg-gray-800 cursor-pointer disabled:opacity-50" />
                <input type="text"
                  value={wlForm.brandAccentColor ?? ''}
                  onChange={(e) => setWlForm((p) => ({ ...p, brandAccentColor: e.target.value }))}
                  placeholder="#d4a853"
                  disabled={!canEdit} className={cn(inputCls, 'flex-1')} />
              </div>
            </Field>
          </div>

          {/* Color preview */}
          {(wlForm.brandPrimaryColor || wlForm.brandAccentColor) && (
            <div className="flex gap-2 p-3 rounded-xl border border-gray-700 bg-gray-800/50">
              <div className="w-8 h-8 rounded-lg" style={{ background: wlForm.brandPrimaryColor ?? '#1a6b5e' }} />
              <div className="w-8 h-8 rounded-lg" style={{ background: wlForm.brandAccentColor ?? '#d4a853' }} />
              <span className="text-xs text-gray-500 self-center ml-1">Brand preview</span>
            </div>
          )}

          {canEdit && (
            <button
              onClick={saveWhitelabel}
              disabled={saving === 'wl'}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white text-sm font-medium transition-colors disabled:opacity-50 mt-2"
            >
              {saving === 'wl' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save White-label
            </button>
          )}
        </Section>

        {/* ── SSO Config ── */}
        <Section title="SSO Configuration" icon={Lock}>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-800/50 border border-gray-700">
            <button
              onClick={() => setSsoForm((p) => ({ ...p, ssoEnabled: !p.ssoEnabled }))}
              disabled={!canEdit}
              className={cn(!canEdit && 'opacity-50 cursor-not-allowed')}
            >
              {ssoForm.ssoEnabled
                ? <ToggleRight className="w-6 h-6 text-emerald-400" />
                : <ToggleLeft className="w-6 h-6 text-gray-600" />}
            </button>
            <div>
              <p className="text-sm font-medium text-white">SSO enabled</p>
              <p className="text-xs text-gray-600">Allows tenant staff to sign in via identity provider</p>
            </div>
          </div>

          <Field label="Identity provider">
            <select
              value={ssoForm.ssoProvider}
              onChange={(e) => setSsoForm((p) => ({ ...p, ssoProvider: e.target.value }))}
              disabled={!canEdit}
              className={cn(selectCls, !canEdit && 'opacity-50')}
            >
              {SSO_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Client ID / App ID">
            <input type="text"
              value={ssoForm.ssoClientId}
              onChange={(e) => setSsoForm((p) => ({ ...p, ssoClientId: e.target.value }))}
              placeholder="abc123..."
              disabled={!canEdit} className={inputCls} />
          </Field>

          <Field label="Client Secret (write-only — leave blank to keep existing)">
            <input type="password"
              value={ssoForm.ssoClientSecret}
              onChange={(e) => setSsoForm((p) => ({ ...p, ssoClientSecret: e.target.value }))}
              placeholder="••••••••"
              disabled={!canEdit} className={inputCls} />
          </Field>

          {(ssoForm.ssoProvider === 'microsoft') && (
            <Field label="Azure AD Tenant ID">
              <input type="text"
                value={ssoForm.ssoTenantId}
                onChange={(e) => setSsoForm((p) => ({ ...p, ssoTenantId: e.target.value }))}
                placeholder="your-azure-tenant-id"
                disabled={!canEdit} className={inputCls} />
            </Field>
          )}

          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
            <p className="text-xs text-amber-400/80 leading-relaxed">
              SSO login requires the tenant's identity provider to be configured with callback URL:
              <code className="block mt-1 font-mono text-amber-300">https://app.resortpro.site/auth/sso/callback</code>
            </p>
          </div>

          {canEdit && (
            <button
              onClick={saveSso}
              disabled={saving === 'sso'}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving === 'sso' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save SSO Config
            </button>
          )}
        </Section>

        {/* ── Onboarding ── */}
        <Section title="Enterprise Onboarding" icon={CheckCircle2}>
          <OnboardingChecklist
            step={profile.onboardingStep}
            completed={!!profile.onboardingCompletedAt}
            notes={profile.enterpriseNotes}
            canEdit={canSupport}
            onUpdate={updateOnboarding}
          />
          {profile.onboardingCompletedAt && (
            <p className="text-xs text-emerald-400 text-center pt-2">
              ✓ Go-live completed on {new Date(profile.onboardingCompletedAt).toLocaleDateString()}
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}
