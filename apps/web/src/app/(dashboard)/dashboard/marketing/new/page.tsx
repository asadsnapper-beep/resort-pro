'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useMutation, useQuery } from '@tanstack/react-query';
import { marketingApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import {
  Megaphone, ChevronRight, ChevronLeft, Users, Clock, Send,
  Loader2, Check, Info, Calendar,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';

type Channel      = 'sms' | 'whatsapp' | 'both';
type AudienceType = 'all' | 'past' | 'upcoming' | 'date_range' | 'vip';

interface WizardState {
  name: string; channel: Channel; audienceType: AudienceType;
  audienceFilter: { days?: number; dateFrom?: string; dateTo?: string; minStays?: number };
  message: string; templateId?: string; scheduleMode: 'now' | 'later'; scheduledAt: string;
}

const STEPS = ['Channel', 'Audience', 'Message', 'Schedule', 'Review'];
const CHAR_LIMIT = 160;

const inputCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#183153] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#183153]/30';
const labelCls = 'block text-[11.5px] font-medium text-[#64748b] mb-1.5';

export default function NewCampaignPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [step, setStep] = useState(0);
  const [audienceCount,  setAudienceCount]  = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  const [form, setForm] = useState<WizardState>({
    name: '', channel: 'sms', audienceType: 'all',
    audienceFilter: {}, message: '', scheduleMode: 'now', scheduledAt: '',
  });
  const set = (patch: Partial<WizardState>) => setForm(p => ({ ...p, ...patch }));

  const { data: tplData } = useQuery({ queryKey: ['marketing-templates'], queryFn: () => marketingApi.listTemplates() });
  const templates = tplData?.data?.data ?? [];

  useEffect(() => {
    if (step !== 1) return;
    let cancelled = false;
    setLoadingCount(true); setAudienceCount(null);
    marketingApi.audiencePreview({ audienceType: form.audienceType, audienceFilter: form.audienceFilter })
      .then(r => { if (!cancelled) setAudienceCount(r.data?.data?.count ?? 0); })
      .catch(() => { if (!cancelled) setAudienceCount(null); })
      .finally(() => { if (!cancelled) setLoadingCount(false); });
    return () => { cancelled = true; };
  }, [step, form.audienceType, form.audienceFilter]);

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => marketingApi.createCampaign(data),
    onSuccess: async (res, vars) => {
      const id = res.data?.data?.id;
      if (vars.sendNow && id) {
        await marketingApi.sendCampaign(id);
        toast({ title: '🚀 Campaign sent!', description: 'Messages are being delivered.' });
      } else {
        toast({ title: '✓ Campaign saved', description: 'Scheduled successfully.' });
      }
      router.push('/dashboard/marketing');
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: e?.response?.data?.error ?? 'Could not create campaign', variant: 'destructive' }),
  });

  const canNext = () => {
    if (step === 0) return form.name.trim().length > 0;
    if (step === 2) return form.message.trim().length > 0;
    if (step === 3) return form.scheduleMode === 'now' || form.scheduledAt !== '';
    return true;
  };
  const next = () => { if (canNext()) setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const back = () => setStep(s => Math.max(s - 1, 0));

  const handleSubmit = (sendNow: boolean) => {
    const payload: Record<string, unknown> = {
      name: form.name, channel: form.channel,
      audienceType: form.audienceType, audienceFilter: form.audienceFilter,
      message: form.message, sendNow,
    };
    if (!sendNow && form.scheduledAt) payload.scheduledAt = new Date(form.scheduledAt).toISOString();
    createMut.mutate({ ...payload, sendNow });
  };

  const smsCount = Math.ceil(form.message.length / CHAR_LIMIT) || 1;

  const stepDotCls = (i: number) => {
    if (i < step)   return { background: '#183153', color: 'var(--rp-btn-accent-text)' };
    if (i === step) return { background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)', boxShadow: '0 0 0 4px rgba(24,49,83,0.18)' };
    return { background: '#e8e5e0', color: 'var(--rp-text-muted)' };
  };

  return (
    <PageShell gap={6} className="max-w-2xl">
      {/* Header */}
      <PageHeader
        icon={
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]" style={{ background: 'var(--rp-teal-bg)' }}>
            <Megaphone className="h-4 w-4" style={{ color: '#183153' }} />
          </div>
        }
        title="New Campaign"
        subtitle="Send SMS or WhatsApp to guests"
      />

      {/* Step progress */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold transition-all"
              style={stepDotCls(i)}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className="text-[12px] font-medium hidden sm:block"
              style={{ color: i === step ? '#183153' : 'var(--rp-text-faint)' }}>{label}</span>
            {i < STEPS.length - 1 && (
              <div className="h-0.5 w-6 rounded"
                style={{ background: i < step ? '#183153' : '#e8e5e0' }} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 0: Channel + Name ─────────────────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-5">
          <div>
            <label className={labelCls}>Campaign Name *</label>
            <input value={form.name} onChange={e => set({ name: e.target.value })}
              placeholder="e.g. Eid Special Offer 2026" autoFocus className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Channel</label>
            <div className="grid grid-cols-3 gap-3 mt-1">
              {[
                { val: 'sms',      label: 'SMS',            icon: '📱', desc: 'Works on all phones' },
                { val: 'whatsapp', label: 'WhatsApp',       icon: '💬', desc: 'Great for urban guests' },
                { val: 'both',     label: 'SMS + WhatsApp', icon: '📡', desc: 'Max reach' },
              ].map(opt => (
                <button key={opt.val} type="button"
                  onClick={() => set({ channel: opt.val as Channel })}
                  className="flex flex-col items-center gap-2 rounded-[12px] border-2 p-4 text-center transition-all"
                  style={form.channel === opt.val
                    ? { borderColor: '#183153', background: 'var(--rp-teal-soft)', boxShadow: '0 0 0 3px rgba(24,49,83,0.1)' }
                    : { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--rp-border-md)', background: isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)' }}>
                  <span className="text-2xl">{opt.icon}</span>
                  <p className="text-[12.5px] font-semibold text-[#183153] dark:text-[#f8fafc]">{opt.label}</p>
                  <p className="text-[11px] text-[#64748b] dark:text-[#a9c1d0]">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 1: Audience ──────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <p className={labelCls}>Who will receive this message?</p>
          <div className="space-y-2">
            {[
              { val: 'all',        label: 'All Guests',           desc: 'All guests with a phone number', icon: '👥' },
              { val: 'past',       label: 'Past Guests',          desc: 'Guests who have checked out at least once', icon: '🏨' },
              { val: 'upcoming',   label: 'Upcoming Guests',      desc: 'Guests checking in soon', icon: '📅' },
              { val: 'date_range', label: 'Guests by Date Range', desc: 'Guests from a specific time period', icon: '📆' },
              { val: 'vip',        label: 'VIP / Repeat Guests',  desc: 'Loyal guests with 2+ stays', icon: '⭐' },
            ].map(opt => (
              <label key={opt.val}
                className="flex items-start gap-3 rounded-[12px] border-2 p-4 cursor-pointer transition-all"
                style={form.audienceType === opt.val
                  ? { borderColor: '#183153', background: 'var(--rp-teal-soft)' }
                  : { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--rp-border-md)', background: isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)' }}>
                <input type="radio" className="mt-0.5" style={{ accentColor: '#183153' }}
                  checked={form.audienceType === opt.val}
                  onChange={() => set({ audienceType: opt.val as AudienceType, audienceFilter: {} })} />
                <div>
                  <p className="text-[13px] font-semibold text-[#183153] dark:text-[#f8fafc]">{opt.icon} {opt.label}</p>
                  <p className="text-[12px] mt-0.5 text-[#64748b] dark:text-[#a9c1d0]">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {form.audienceType === 'upcoming' && (
            <div className="rounded-[12px] border p-4 space-y-2"
              style={{ background: 'var(--rp-teal-soft)', borderColor: 'rgba(24,49,83,0.2)' }}>
              <label className={labelCls}>Check-in within how many days?</label>
              <div className="flex gap-2 flex-wrap">
                {[3, 7, 14, 30].map(d => (
                  <button key={d} type="button" onClick={() => set({ audienceFilter: { days: d } })}
                    className="rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors"
                    style={form.audienceFilter.days === d
                      ? { background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }
                      : { background: isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--rp-border-md)', color: isDark ? '#a9c1d0' : 'var(--rp-text-subtle)' }}>
                    {d} days
                  </button>
                ))}
              </div>
            </div>
          )}

          {form.audienceType === 'date_range' && (
            <div className="rounded-[12px] border p-4 space-y-3"
              style={{ background: 'var(--rp-teal-soft)', borderColor: 'rgba(24,49,83,0.2)' }}>
              <p className={labelCls}>Date range (check-in date)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>From</label>
                  <input type="date" value={form.audienceFilter.dateFrom ?? ''}
                    onChange={e => set({ audienceFilter: { ...form.audienceFilter, dateFrom: e.target.value } })}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>To</label>
                  <input type="date" value={form.audienceFilter.dateTo ?? ''}
                    onChange={e => set({ audienceFilter: { ...form.audienceFilter, dateTo: e.target.value } })}
                    className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {form.audienceType === 'vip' && (
            <div className="rounded-[12px] border p-4 space-y-2"
              style={{ background: 'var(--rp-teal-soft)', borderColor: 'rgba(24,49,83,0.2)' }}>
              <label className={labelCls}>Minimum stays</label>
              <div className="flex gap-2">
                {[2, 3, 5].map(n => (
                  <button key={n} type="button" onClick={() => set({ audienceFilter: { minStays: n } })}
                    className="rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors"
                    style={form.audienceFilter.minStays === n
                      ? { background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }
                      : { background: isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--rp-border-md)', color: isDark ? '#a9c1d0' : 'var(--rp-text-subtle)' }}>
                    {n}+ stays
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-[10px] border px-4 py-3 text-[13px] font-medium"
            style={audienceCount === 0
              ? { background: 'var(--rp-red-bg)', borderColor: 'rgba(200,60,60,0.15)', color: '#c43c3c' }
              : { background: 'var(--rp-teal-bg)', borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }}>
            {loadingCount
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Counting…</>
              : audienceCount === null
              ? <><Users className="h-4 w-4" /> Calculating…</>
              : <><Users className="h-4 w-4" /> <strong>{audienceCount}</strong> guests will receive this message</>}
          </div>
        </div>
      )}

      {/* ── Step 2: Message ───────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          {templates.length > 0 && (
            <div className="space-y-2">
              <label className={labelCls}>Use a template (optional)</label>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {templates
                  .filter((t: { channel: string }) => t.channel === 'both' || t.channel === form.channel)
                  .map((t: { id: string; name: string; message: string }) => (
                    <button key={t.id} type="button"
                      onClick={() => set({ message: t.message, templateId: t.id })}
                      className="w-full text-left rounded-[10px] border p-3 transition-colors hover:bg-[#f5f9fc]"
                      style={{ borderColor: 'var(--rp-border-md)' }}>
                      <p className="text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">{t.name}</p>
                      <p className="text-[12px] mt-0.5 line-clamp-1 text-[#64748b] dark:text-[#a9c1d0]">{t.message}</p>
                    </button>
                  ))}
              </div>
              <div className="h-px" style={{ background: 'var(--rp-border)' }} />
            </div>
          )}
          <div>
            <label className={labelCls}>Message *</label>
            <textarea value={form.message} onChange={e => set({ message: e.target.value })}
              rows={5} placeholder="e.g. Palm Paradise Resort: Special offer this weekend — 20% off 2+ night stays. Book: yourresort.com/offer"
              className={inputCls + ' resize-none'} />
            <div className="flex items-center justify-between mt-1 text-[11.5px] text-[#64748b] dark:text-[#a9c1d0]">
              <span>
                Available tokens:{' '}
                <code className="rounded-[4px] px-1 py-0.5 text-[10.5px]" style={{ background: 'var(--rp-surface-3)', color: 'var(--rp-text-subtle)' }}>{'{guest_name}'}</code>
                {' '}
                <code className="rounded-[4px] px-1 py-0.5 text-[10.5px]" style={{ background: 'var(--rp-surface-3)', color: 'var(--rp-text-subtle)' }}>{'{resort_name}'}</code>
              </span>
              <span style={{ color: form.message.length > CHAR_LIMIT ? '#b89040' : 'var(--rp-text-muted)' }}>
                {form.message.length} chars{form.channel !== 'whatsapp' && ` · ${smsCount} SMS`}
              </span>
            </div>
          </div>
          {form.channel !== 'whatsapp' && smsCount > 1 && (
            <div className="flex items-start gap-2 rounded-[10px] border p-3 text-[12.5px]"
              style={{ background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.2)', color: '#b89040' }}>
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>This message is {smsCount} SMS parts. Each part costs separately. Keep it under 160 characters.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Schedule ──────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <p className={labelCls}>When to send?</p>
          <div className="space-y-2">
            {[
              { val: 'now',   label: 'Send Now',    desc: 'Starts sending immediately after submit', icon: '🚀' },
              { val: 'later', label: 'Schedule',    desc: 'Send on a specific date and time',        icon: '⏰' },
            ].map(opt => (
              <label key={opt.val}
                className="flex items-start gap-3 rounded-[12px] border-2 p-4 cursor-pointer transition-all"
                style={form.scheduleMode === opt.val
                  ? { borderColor: '#183153', background: 'var(--rp-teal-soft)' }
                  : { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--rp-border-md)', background: isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)' }}>
                <input type="radio" className="mt-0.5" style={{ accentColor: '#183153' }}
                  checked={form.scheduleMode === opt.val}
                  onChange={() => set({ scheduleMode: opt.val as 'now' | 'later' })} />
                <div>
                  <p className="text-[13px] font-semibold text-[#183153] dark:text-[#f8fafc]">{opt.icon} {opt.label}</p>
                  <p className="text-[12px] mt-0.5 text-[#64748b] dark:text-[#a9c1d0]">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
          {form.scheduleMode === 'later' && (
            <div className="space-y-2">
              <label className={labelCls}>Date & Time</label>
              <input type="datetime-local" value={form.scheduledAt}
                onChange={e => set({ scheduledAt: e.target.value })}
                min={new Date().toISOString().slice(0, 16)}
                className={inputCls} />
              <div className="flex items-start gap-2 rounded-[10px] border p-3 text-[12px]"
                style={{ background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.2)', color: '#b89040' }}>
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <p>Marketing SMS/WhatsApp should not be sent between 10pm and 8am (BTRC guideline)</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 4: Review ────────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-4">
          <p className={labelCls}>Campaign Summary</p>
          <div className="rounded-[14px] border overflow-hidden"
            style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            {[
              { label: 'Campaign Name', value: form.name },
              { label: 'Channel',       value: form.channel === 'sms' ? '📱 SMS' : form.channel === 'whatsapp' ? '💬 WhatsApp' : '📱💬 SMS + WhatsApp' },
              { label: 'Audience',      value: `${
                form.audienceType === 'all'        ? 'All Guests' :
                form.audienceType === 'past'       ? 'Past Guests' :
                form.audienceType === 'upcoming'   ? `Upcoming (${form.audienceFilter.days ?? 7} days)` :
                form.audienceType === 'vip'        ? `VIP (${form.audienceFilter.minStays ?? 2}+ stays)` : 'Date Range'
              } · ${audienceCount ?? '?'} recipients` },
              { label: 'Send Time',     value: form.scheduleMode === 'now' ? '🚀 Immediately' : `⏰ ${form.scheduledAt ? new Date(form.scheduledAt).toLocaleString('en-GB') : '—'}` },
            ].map(({ label, value }, i, arr) => (
              <div key={label} className="flex items-start justify-between px-4 py-3 text-[13px]"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : undefined }}>
                <span className="w-32 shrink-0 text-[#64748b] dark:text-[#a9c1d0]">{label}</span>
                <span className="font-medium text-right text-[#183153] dark:text-[#f8fafc]">{value}</span>
              </div>
            ))}
          </div>

          <div>
            <p className={labelCls}>Message Preview</p>
            <div className="rounded-[12px] border p-4 text-[13px] whitespace-pre-wrap font-mono"
              style={{ background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)', color: 'var(--rp-text)' }}>
              {form.message || '(empty)'}
            </div>
          </div>

          {audienceCount === 0 && (
            <div className="flex items-start gap-2 rounded-[10px] border p-3 text-[12.5px]"
              style={{ background: 'var(--rp-red-bg)', borderColor: 'rgba(200,60,60,0.15)', color: '#c43c3c' }}>
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              No recipients found. Go back and change the audience filter.
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <button onClick={back} disabled={step === 0}
          className="flex items-center gap-2 rounded-[9px] border px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-40 hover:bg-[#f4f1eb]"
          style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        {step < STEPS.length - 1 ? (
          <button onClick={next} disabled={!canNext()}
            className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-40 hover:opacity-90"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex gap-3">
            <button onClick={() => handleSubmit(false)}
              disabled={createMut.isPending || audienceCount === 0}
              className="flex items-center gap-2 rounded-[9px] border px-4 py-2 text-[13px] font-medium disabled:opacity-40 hover:bg-[#f4f1eb]"
              style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
              {createMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Clock className="h-4 w-4" />
              {form.scheduleMode === 'later' ? 'Schedule' : 'Save as Draft'}
            </button>
            {form.scheduleMode === 'now' && (
              <button onClick={() => handleSubmit(true)}
                disabled={createMut.isPending || audienceCount === 0}
                className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-40 hover:opacity-90"
                style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                {createMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Send className="h-4 w-4" /> Send Campaign
              </button>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
