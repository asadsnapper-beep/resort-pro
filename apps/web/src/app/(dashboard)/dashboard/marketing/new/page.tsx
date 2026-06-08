'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { marketingApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import {
  Megaphone, ChevronRight, ChevronLeft, Phone, MessageSquare,
  Users, Clock, Send, Loader2, Check, Info, Calendar,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Channel = 'sms' | 'whatsapp' | 'both';
type AudienceType = 'all' | 'past' | 'upcoming' | 'date_range' | 'vip';

interface WizardState {
  name:         string;
  channel:      Channel;
  audienceType: AudienceType;
  audienceFilter: {
    days?:     number;
    dateFrom?: string;
    dateTo?:   string;
    minStays?: number;
  };
  message:      string;
  templateId?:  string;
  scheduleMode: 'now' | 'later';
  scheduledAt:  string;
}

const STEPS = ['Channel', 'Audience', 'Message', 'Schedule', 'Review'];

const CHAR_LIMIT = 160;

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  const [form, setForm] = useState<WizardState>({
    name:           '',
    channel:        'sms',
    audienceType:   'all',
    audienceFilter: {},
    message:        '',
    scheduleMode:   'now',
    scheduledAt:    '',
  });

  const set = (patch: Partial<WizardState>) => setForm(p => ({ ...p, ...patch }));

  // Fetch templates for message step
  const { data: tplData } = useQuery({
    queryKey: ['marketing-templates'],
    queryFn: () => marketingApi.listTemplates(),
  });
  const templates = tplData?.data?.data ?? [];

  // Audience preview whenever audienceType/filter changes
  useEffect(() => {
    if (step !== 1) return;
    let cancelled = false;
    setLoadingCount(true);
    setAudienceCount(null);
    marketingApi.audiencePreview({ audienceType: form.audienceType, audienceFilter: form.audienceFilter })
      .then(r => { if (!cancelled) setAudienceCount(r.data?.data?.count ?? 0); })
      .catch(() => { if (!cancelled) setAudienceCount(null); })
      .finally(() => { if (!cancelled) setLoadingCount(false); });
    return () => { cancelled = true; };
  }, [step, form.audienceType, form.audienceFilter]);

  const createMut = useMutation({
    mutationFn: (data: any) => marketingApi.createCampaign(data),
    onSuccess: async (res, vars) => {
      const id = res.data?.data?.id;
      if (vars.sendNow && id) {
        await marketingApi.sendCampaign(id);
        toast({ title: '🚀 Campaign sent!', description: 'Messages are being delivered.' });
      } else {
        toast({ title: '✓ Campaign saved', description: vars.sendNow ? 'Sending...' : 'Scheduled successfully.' });
      }
      router.push('/dashboard/marketing');
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.error ?? 'Could not create campaign', variant: 'destructive' }),
  });

  // ── Step validation ──────────────────────────────────────────────────────────
  const canNext = () => {
    if (step === 0) return form.name.trim().length > 0;
    if (step === 1) return true;
    if (step === 2) return form.message.trim().length > 0;
    if (step === 3) return form.scheduleMode === 'now' || form.scheduledAt !== '';
    return true;
  };

  const next = () => { if (canNext()) setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const back = () => setStep(s => Math.max(s - 1, 0));

  const handleSubmit = (sendNow: boolean) => {
    const payload: any = {
      name:           form.name,
      channel:        form.channel,
      audienceType:   form.audienceType,
      audienceFilter: form.audienceFilter,
      message:        form.message,
      sendNow,
    };
    if (!sendNow && form.scheduledAt) {
      payload.scheduledAt = new Date(form.scheduledAt).toISOString();
    }
    createMut.mutate({ ...payload, sendNow });
  };

  const smsCount = Math.ceil(form.message.length / CHAR_LIMIT) || 1;

  // ── Render steps ─────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-resort-600" /> New Campaign
        </h1>
        <p className="text-gray-500 text-sm mt-1">Guests-দের SMS বা WhatsApp পাঠাও</p>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
              i < step ? 'bg-resort-600 text-white' :
              i === step ? 'bg-resort-600 text-white ring-4 ring-resort-100' :
              'bg-gray-100 text-gray-400'
            }`}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-resort-700' : 'text-gray-400'}`}>{label}</span>
            {i < STEPS.length - 1 && <div className={`h-0.5 w-6 rounded ${i < step ? 'bg-resort-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* ── Step 0: Channel + Name ──────────────────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Campaign Name *</label>
            <Input
              value={form.name}
              onChange={e => set({ name: e.target.value })}
              placeholder="e.g. Eid Special Offer 2026"
              className="text-base"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Channel</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { val: 'sms',       label: 'SMS',            icon: '📱', desc: 'সব ফোনে কাজ করে' },
                { val: 'whatsapp',  label: 'WhatsApp',       icon: '💬', desc: 'শহরের guests এর জন্য ভালো' },
                { val: 'both',      label: 'SMS + WhatsApp', icon: '📡', desc: 'সব channel, বেশি reach' },
              ].map(opt => (
                <button key={opt.val} type="button"
                  onClick={() => set({ channel: opt.val as Channel })}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-center ${
                    form.channel === opt.val
                      ? 'border-resort-500 bg-resort-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <span className="text-2xl">{opt.icon}</span>
                  <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 1: Audience ────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-gray-700">কাদের পাঠাবে?</p>

          <div className="space-y-2">
            {[
              { val: 'all',        label: 'All Guests',            desc: 'সব guests যাদের phone number আছে',         icon: '👥' },
              { val: 'past',       label: 'Past Guests',           desc: 'যারা কমপক্ষে একবার check-out করেছে',       icon: '🏨' },
              { val: 'upcoming',   label: 'Upcoming Guests',       desc: 'আগামী কিছুদিনে check-in আছে এমন guests',   icon: '📅' },
              { val: 'date_range', label: 'Guests by Date Range',  desc: 'নির্দিষ্ট সময়ে যারা এসেছিল',              icon: '📆' },
              { val: 'vip',        label: 'VIP / Repeat Guests',   desc: '২+ বার এসেছে এমন loyal guests',            icon: '⭐' },
            ].map(opt => (
              <label key={opt.val}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  form.audienceType === opt.val
                    ? 'border-resort-500 bg-resort-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                <input type="radio" className="mt-0.5 accent-resort-600"
                  checked={form.audienceType === opt.val}
                  onChange={() => set({ audienceType: opt.val as AudienceType, audienceFilter: {} })} />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{opt.icon} {opt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Extra filter fields */}
          {form.audienceType === 'upcoming' && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
              <label className="text-sm font-medium text-gray-700">আগামী কত দিনের মধ্যে check-in?</label>
              <div className="flex gap-2 flex-wrap">
                {[3, 7, 14, 30].map(d => (
                  <button key={d} type="button"
                    onClick={() => set({ audienceFilter: { days: d } })}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      form.audienceFilter.days === d ? 'bg-resort-600 text-white border-resort-600' : 'bg-white border-gray-200 text-gray-700'
                    }`}>
                    {d} days
                  </button>
                ))}
              </div>
            </div>
          )}

          {form.audienceType === 'date_range' && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Date range (check-in date)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">From</label>
                  <Input type="date" value={form.audienceFilter.dateFrom ?? ''}
                    onChange={e => set({ audienceFilter: { ...form.audienceFilter, dateFrom: e.target.value } })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">To</label>
                  <Input type="date" value={form.audienceFilter.dateTo ?? ''}
                    onChange={e => set({ audienceFilter: { ...form.audienceFilter, dateTo: e.target.value } })} />
                </div>
              </div>
            </div>
          )}

          {form.audienceType === 'vip' && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
              <label className="text-sm font-medium text-gray-700">Minimum stays</label>
              <div className="flex gap-2">
                {[2, 3, 5].map(n => (
                  <button key={n} type="button"
                    onClick={() => set({ audienceFilter: { minStays: n } })}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      form.audienceFilter.minStays === n ? 'bg-resort-600 text-white border-resort-600' : 'bg-white border-gray-200 text-gray-700'
                    }`}>
                    {n}+ stays
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Count preview */}
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
            audienceCount === 0 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'
          }`}>
            {loadingCount ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Counting...</>
            ) : audienceCount === null ? (
              <><Users className="h-4 w-4" /> Calculating...</>
            ) : (
              <><Users className="h-4 w-4" /> <strong>{audienceCount}</strong> guests will receive this message</>
            )}
          </div>
        </div>
      )}

      {/* ── Step 2: Message ─────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Template picker */}
          {templates.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Use a template (optional)</label>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {templates
                  .filter((t: any) => t.channel === 'both' || t.channel === form.channel)
                  .map((t: any) => (
                    <button key={t.id} type="button"
                      onClick={() => set({ message: t.message, templateId: t.id })}
                      className="w-full text-left p-3 rounded-xl border hover:border-resort-300 hover:bg-resort-50 transition-colors">
                      <p className="text-sm font-medium text-gray-800">{t.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{t.message}</p>
                    </button>
                  ))}
              </div>
              <div className="h-px bg-gray-100" />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Message *</label>
            <textarea
              value={form.message}
              onChange={e => set({ message: e.target.value })}
              rows={5}
              placeholder={`e.g. Palm Paradise Resort: এই ঈদে বিশেষ অফার! 2 রাত বুক করলে 20% ছাড়। বুক করুন: palmparadise.com/eid`}
              className="w-full rounded-xl border border-gray-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-resort-400 focus:border-transparent"
            />
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Available tokens: <code className="bg-gray-100 px-1 rounded">{'{guest_name}'}</code> <code className="bg-gray-100 px-1 rounded">{'{resort_name}'}</code></span>
              <span className={form.message.length > CHAR_LIMIT ? 'text-amber-600 font-medium' : ''}>
                {form.message.length} chars
                {form.channel !== 'whatsapp' && ` · ${smsCount} SMS`}
              </span>
            </div>
          </div>

          {form.channel !== 'whatsapp' && smsCount > 1 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>This message is {smsCount} SMS parts. Each part costs separately. Try to keep it under 160 characters.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Schedule ────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-gray-700">কখন পাঠাবে?</p>

          <div className="space-y-2">
            {[
              { val: 'now',   label: 'এখনই পাঠাও',   desc: 'Submit করার সাথে সাথে send শুরু হবে', icon: '🚀' },
              { val: 'later', label: 'Schedule করো',  desc: 'নির্দিষ্ট দিন ও সময়ে পাঠাবে',        icon: '⏰' },
            ].map(opt => (
              <label key={opt.val}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  form.scheduleMode === opt.val
                    ? 'border-resort-500 bg-resort-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                <input type="radio" className="mt-0.5 accent-resort-600"
                  checked={form.scheduleMode === opt.val}
                  onChange={() => set({ scheduleMode: opt.val as 'now' | 'later' })} />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{opt.icon} {opt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {form.scheduleMode === 'later' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Date & Time</label>
              <Input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={e => set({ scheduledAt: e.target.value })}
                min={new Date().toISOString().slice(0, 16)}
              />
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <p>Marketing SMS/WhatsApp রাত 10টা থেকে সকাল 8টার মধ্যে পাঠানো যাবে না (BTRC guideline)</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 4: Review & Send ───────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-gray-700">Campaign Summary</p>

          <div className="bg-white rounded-2xl border divide-y">
            {[
              { label: 'Campaign Name', value: form.name },
              { label: 'Channel',       value: form.channel === 'sms' ? '📱 SMS' : form.channel === 'whatsapp' ? '💬 WhatsApp' : '📱💬 SMS + WhatsApp' },
              { label: 'Audience',      value: `${form.audienceType === 'all' ? 'All Guests' : form.audienceType === 'past' ? 'Past Guests' : form.audienceType === 'upcoming' ? `Upcoming (${form.audienceFilter.days ?? 7} days)` : form.audienceType === 'vip' ? `VIP (${form.audienceFilter.minStays ?? 2}+ stays)` : 'Date Range'} · ${audienceCount ?? '?'} recipients` },
              { label: 'Send Time',     value: form.scheduleMode === 'now' ? '🚀 Immediately' : `⏰ ${form.scheduledAt ? new Date(form.scheduledAt).toLocaleString('en-GB') : '—'}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between px-4 py-3 text-sm">
                <span className="text-gray-500 w-32 shrink-0">{label}</span>
                <span className="text-gray-900 font-medium text-right">{value}</span>
              </div>
            ))}
          </div>

          {/* Message preview */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Message Preview</p>
            <div className="bg-gray-50 border rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap font-mono">
              {form.message || '(empty)'}
            </div>
          </div>

          {/* Warning if no recipients */}
          {audienceCount === 0 && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              No recipients found. Go back and change the audience filter.
            </div>
          )}
        </div>
      )}

      {/* ── Navigation buttons ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t">
        <Button variant="outline" onClick={back} disabled={step === 0} className="gap-2">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={next} disabled={!canNext()} className="gap-2 bg-resort-600 hover:bg-resort-700">
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button variant="outline"
              onClick={() => handleSubmit(false)}
              loading={createMut.isPending}
              disabled={audienceCount === 0}
              className="gap-2">
              <Clock className="h-4 w-4" />
              {form.scheduleMode === 'later' ? 'Schedule' : 'Save as Draft'}
            </Button>
            {form.scheduleMode === 'now' && (
              <Button
                onClick={() => handleSubmit(true)}
                loading={createMut.isPending}
                disabled={audienceCount === 0}
                className="gap-2 bg-resort-600 hover:bg-resort-700">
                <Send className="h-4 w-4" /> Send Campaign
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
