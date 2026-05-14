'use client';

import { useState, useEffect } from 'react';
import { adminEndpoints } from '@/lib/admin-api';
import { toast } from '@/hooks/use-toast';
import {
  Settings, Save, Plus, Trash2, Loader2,
  DollarSign, Clock, Tag, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type PlanFeature = string;

type Plan = {
  key: string;
  name: string;
  price: number;
  roomLimit: number;
  features: PlanFeature[];
};

type PlatformSettings = {
  id: string;
  trialDays: number;
  plans: Plan[];
  updatedAt: string;
};

const PLAN_KEY_OPTIONS = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM'];

function PlanEditor({
  plan,
  index,
  onChange,
  onDelete,
  canDelete,
}: {
  plan: Plan;
  index: number;
  onChange: (updated: Plan) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const setField = <K extends keyof Plan>(key: K, value: Plan[K]) => {
    onChange({ ...plan, [key]: value });
  };

  const addFeature = () => {
    onChange({ ...plan, features: [...plan.features, ''] });
  };

  const updateFeature = (i: number, value: string) => {
    const f = [...plan.features];
    f[i] = value;
    onChange({ ...plan, features: f });
  };

  const removeFeature = (i: number) => {
    onChange({ ...plan, features: plan.features.filter((_, idx) => idx !== i) });
  };

  const planGradients: Record<string, string> = {
    STARTER: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20',
    PROFESSIONAL: 'from-blue-500/10 to-indigo-500/10 border-blue-500/20',
    ENTERPRISE: 'from-amber-500/10 to-orange-500/10 border-amber-500/20',
    CUSTOM: 'from-purple-500/10 to-pink-500/10 border-purple-500/20',
  };

  const gradient = planGradients[plan.key] || 'from-gray-800/50 to-gray-800/50 border-gray-700';

  return (
    <div className={cn('rounded-2xl border bg-gradient-to-br p-5', gradient)}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{plan.name || 'Unnamed Plan'}</p>
            <p className="text-gray-500 text-xs">{plan.key} · ${plan.price}/mo · {plan.roomLimit === -1 ? 'Unlimited' : plan.roomLimit} rooms</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canDelete && (
            <button
              onClick={onDelete}
              className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-7 h-7 rounded-lg bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-4">
          {/* Row 1: Key + Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Plan Key</label>
              <select
                value={plan.key}
                onChange={(e) => setField('key', e.target.value)}
                className="w-full h-9 bg-gray-800 border border-gray-700 rounded-lg px-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {PLAN_KEY_OPTIONS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Display Name</label>
              <input
                type="text"
                value={plan.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. Starter"
                className="w-full h-9 bg-gray-800 border border-gray-700 rounded-lg px-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Row 2: Price + Room Limit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                <DollarSign className="w-3 h-3 inline mr-1" />
                Monthly Price (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  value={plan.price}
                  min={0}
                  onChange={(e) => setField('price', Number(e.target.value))}
                  className="w-full h-9 bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Room Limit <span className="text-gray-600">(−1 = unlimited)</span>
              </label>
              <input
                type="number"
                value={plan.roomLimit}
                min={-1}
                onChange={(e) => setField('roomLimit', Number(e.target.value))}
                className="w-full h-9 bg-gray-800 border border-gray-700 rounded-lg px-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Features */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-400">Features</label>
              <button
                onClick={addFeature}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <Plus className="w-3 h-3" /> Add feature
              </button>
            </div>
            <div className="space-y-2">
              {plan.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <input
                    type="text"
                    value={f}
                    onChange={(e) => updateFeature(i, e.target.value)}
                    placeholder={`Feature ${i + 1}`}
                    className="flex-1 h-8 bg-gray-800/80 border border-gray-700 rounded-lg px-3 text-white text-xs placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => removeFeature(i)}
                    className="w-6 h-6 rounded flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {plan.features.length === 0 && (
                <p className="text-gray-600 text-xs italic">No features yet — click "Add feature"</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [trialDays, setTrialDays] = useState(14);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    adminEndpoints.getSettings()
      .then((r) => {
        const s = r.data.data as PlatformSettings;
        setSettings(s);
        setTrialDays(s.trialDays);
        setPlans(s.plans);
        setSavedAt(s.updatedAt);
      })
      .catch(() => toast({ title: 'Failed to load settings', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, []);

  const markChanged = () => setHasChanges(true);

  const updatePlan = (index: number, updated: Plan) => {
    const newPlans = [...plans];
    newPlans[index] = updated;
    setPlans(newPlans);
    markChanged();
  };

  const deletePlan = (index: number) => {
    setPlans(plans.filter((_, i) => i !== index));
    markChanged();
  };

  const addPlan = () => {
    setPlans([
      ...plans,
      { key: 'CUSTOM', name: 'New Plan', price: 0, roomLimit: 10, features: ['Feature 1'] },
    ]);
    markChanged();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validate
      for (const p of plans) {
        if (!p.name.trim()) {
          toast({ title: 'Each plan must have a name', variant: 'destructive' });
          setSaving(false);
          return;
        }
        if (p.price < 0) {
          toast({ title: 'Price cannot be negative', variant: 'destructive' });
          setSaving(false);
          return;
        }
      }

      const res = await adminEndpoints.updateSettings({ trialDays, plans });
      const updated = res.data.data as PlatformSettings;
      setSettings(updated);
      setSavedAt(updated.updatedAt);
      setHasChanges(false);
      toast({ title: 'Settings saved', description: 'Platform settings updated successfully.' });
    } catch (err: any) {
      toast({ title: err?.response?.data?.error || 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!settings) return;
    setTrialDays(settings.trialDays);
    setPlans(settings.plans);
    setHasChanges(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const totalMRR = plans.reduce((sum, p) => sum + p.price, 0);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center">
              <Settings className="w-5 h-5 text-indigo-400" />
            </div>
            Platform Settings
          </h1>
          <p className="text-gray-500 text-sm mt-1.5">
            Configure plans, pricing, and trial settings for all new signups
          </p>
          {savedAt && (
            <p className="text-gray-600 text-xs mt-1">
              Last saved: {new Date(savedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 h-9 px-4 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={cn(
              'flex items-center gap-2 h-9 px-5 rounded-lg font-semibold text-sm transition-all',
              hasChanges
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed',
            )}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {hasChanges && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          You have unsaved changes. Click "Save Changes" to apply.
        </div>
      )}

      {/* Trial Duration Section */}
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold">Free Trial Duration</h2>
            <p className="text-gray-500 text-sm">How many days new signups get for free</p>
          </div>
          <span className="ml-auto text-3xl font-bold text-white">{trialDays}<span className="text-lg text-gray-400 font-normal"> days</span></span>
        </div>

        <div className="space-y-3">
          <input
            type="range"
            min={1}
            max={90}
            value={trialDays}
            onChange={(e) => { setTrialDays(Number(e.target.value)); markChanged(); }}
            className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-gray-600">
            <span>1 day</span>
            <span>30 days</span>
            <span>60 days</span>
            <span>90 days</span>
          </div>
          <div className="flex gap-2 flex-wrap mt-2">
            {[7, 14, 21, 30].map((d) => (
              <button
                key={d}
                onClick={() => { setTrialDays(d); markChanged(); }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  trialDays === d
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700',
                )}
              >
                {d} days
              </button>
            ))}
            <div className="flex items-center gap-2 ml-2">
              <span className="text-gray-500 text-sm">Custom:</span>
              <input
                type="number"
                value={trialDays}
                min={1}
                max={365}
                onChange={(e) => { setTrialDays(Math.max(1, Math.min(365, Number(e.target.value)))); markChanged(); }}
                className="w-16 h-7 bg-gray-800 border border-gray-700 rounded-lg px-2 text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-800/60 rounded-xl text-xs text-gray-500">
          <strong className="text-gray-300">How it works:</strong> New signups automatically get a free trial of this duration. After it expires, they're redirected to the upgrade page. You can extend individual trials anytime from the Tenants page.
        </div>
      </section>

      {/* Plans Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Tag className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Subscription Plans</h2>
              <p className="text-gray-500 text-sm">{plans.length} plans · Combined max MRR potential: ${totalMRR}/mo per customer</p>
            </div>
          </div>
          <button
            onClick={addPlan}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-medium border border-gray-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Plan
          </button>
        </div>

        <div className="space-y-4">
          {plans.map((plan, i) => (
            <PlanEditor
              key={i}
              plan={plan}
              index={i}
              onChange={(updated) => updatePlan(i, updated)}
              onDelete={() => deletePlan(i)}
              canDelete={plans.length > 1}
            />
          ))}
        </div>
      </section>

      {/* Preview */}
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          Plan Preview (what customers see)
        </h2>
        <div className={cn(
          'grid gap-4',
          plans.length === 1 ? 'grid-cols-1 max-w-xs' : plans.length === 2 ? 'grid-cols-2' : 'grid-cols-3',
        )}>
          {plans.map((plan, i) => (
            <div
              key={i}
              className={cn(
                'rounded-xl border p-4',
                i === 1 && plans.length === 3
                  ? 'bg-indigo-600/10 border-indigo-500/30'
                  : 'bg-gray-800/60 border-gray-700/50',
              )}
            >
              {i === 1 && plans.length === 3 && (
                <span className="text-[10px] font-bold bg-indigo-500 text-white px-2 py-0.5 rounded-full mb-2 inline-block">POPULAR</span>
              )}
              <p className="text-white font-semibold text-sm">{plan.name}</p>
              <p className="text-2xl font-bold text-white mt-1">
                ${plan.price}<span className="text-sm text-gray-400 font-normal">/mo</span>
              </p>
              <ul className="mt-3 space-y-1.5">
                {plan.features.slice(0, 4).map((f, j) => (
                  <li key={j} className="text-xs text-gray-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    {f || <span className="italic text-gray-600">Feature...</span>}
                  </li>
                ))}
                {plan.features.length > 4 && (
                  <li className="text-xs text-gray-600">+{plan.features.length - 4} more</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Sticky save bar */}
      {hasChanges && (
        <div className="sticky bottom-0 left-0 right-0 flex items-center justify-between gap-4 bg-gray-900/95 backdrop-blur border-t border-gray-800 px-6 py-4 -mx-6 rounded-b-xl">
          <p className="text-sm text-gray-400">
            <span className="text-amber-400 font-medium">Unsaved changes.</span> New signups will use updated settings.
          </p>
          <div className="flex items-center gap-3">
            <button onClick={handleReset} className="text-sm text-gray-400 hover:text-white transition-colors">
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save & Apply'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
