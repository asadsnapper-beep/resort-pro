'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { billingApi, tenantApi, roomsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import {
  Building2, Clock, BedDouble, ChevronRight, ChevronLeft,
  CheckCircle, Loader2, ArrowRight, SkipForward, Copy, Check,
  ExternalLink, MessageCircle,
} from 'lucide-react';

// ── Schemas ──────────────────────────────────────────────────────────────────

const propertySchema = z.object({
  phone: z.string().min(5, 'Phone required'),
  email: z.string().email('Valid email required'),
  address: z.string().min(5, 'Address required'),
  currency: z.string().length(3, 'Must be 3-letter code (e.g. USD)'),
  timezone: z.string().min(1, 'Timezone required'),
});

const timesSchema = z.object({
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
});

const roomSchema = z.object({
  name: z.string().min(1, 'Room name required'),
  number: z.string().min(1, 'Room number required'),
  type: z.enum(['STANDARD', 'DELUXE', 'SUITE', 'VILLA', 'COTTAGE', 'BUNGALOW']),
  basePrice: z.coerce.number().min(1, 'Price required'),
  maxOccupancy: z.coerce.number().int().min(1),
  floor: z.coerce.number().int().min(0).optional(),
  description: z.string().optional(),
});

type PropertyData = z.infer<typeof propertySchema>;
type TimesData = z.infer<typeof timesSchema>;
type RoomData = z.infer<typeof roomSchema>;

const TIMEZONES = [
  'Asia/Dhaka', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Bangkok',
  'Asia/Dubai', 'Europe/London', 'Europe/Paris', 'America/New_York',
  'America/Los_Angeles', 'America/Chicago', 'Australia/Sydney', 'Pacific/Auckland',
];

const CURRENCIES = ['BDT', 'USD', 'EUR', 'GBP', 'SGD', 'AED', 'THB', 'INR', 'AUD', 'NZD'];

const ROOM_TYPES = ['STANDARD', 'DELUXE', 'SUITE', 'VILLA', 'COTTAGE', 'BUNGALOW'] as const;

// ── Step indicator ────────────────────────────────────────────────────────────

function StepBar({ current, total }: { current: number; total: number }) {
  const steps = [
    { label: 'Property', icon: Building2 },
    { label: 'Timings', icon: Clock },
    { label: 'First Room', icon: BedDouble },
  ];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const Icon = s.icon;
        return (
          <div key={s.label} className="flex items-center flex-1">
            <div className={`flex flex-col items-center gap-1 flex-1 ${i < total - 1 ? '' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                done ? 'bg-[#1a6b5e] text-white' :
                active ? 'bg-[#d4a853] text-white ring-4 ring-[#d4a853]/20' :
                'bg-gray-100 text-gray-400'
              }`}>
                {done ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className={`text-xs font-medium ${active ? 'text-[#1a6b5e]' : done ? 'text-[#1a6b5e]' : 'text-gray-400'}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 -mt-5 mx-1 ${done ? 'bg-[#1a6b5e]' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Property Info ─────────────────────────────────────────────────────

function Step1({ onNext }: { onNext: () => void }) {
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<PropertyData>({
    resolver: zodResolver(propertySchema),
    defaultValues: { currency: 'USD', timezone: 'Asia/Dhaka' },
  });

  const onSubmit = async (data: PropertyData) => {
    setSaving(true);
    try {
      await tenantApi.update(data);
      onNext();
    } catch {
      toast({ title: 'Error', description: 'Failed to save. Try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
          <Input {...register('phone')} placeholder="+880 1700 000000" className={errors.phone ? 'border-red-400' : ''} />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Resort Email</label>
          <Input {...register('email')} type="email" placeholder="contact@yourresort.com" className={errors.email ? 'border-red-400' : ''} />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Address</label>
        <Input {...register('address')} placeholder="123 Beach Road, Cox's Bazar, Bangladesh" className={errors.address ? 'border-red-400' : ''} />
        {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency</label>
          <select {...register('currency')} className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b5e]">
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
          <select {...register('timezone')} className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b5e]">
            {TIMEZONES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>

      <Button type="submit" disabled={saving} className="w-full bg-[#1a6b5e] hover:bg-[#145a4f] text-white mt-2">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : <>Save & Continue <ChevronRight className="w-4 h-4 ml-1" /></>}
      </Button>
    </form>
  );
}

// ── Step 2: Check-in / Check-out Times ────────────────────────────────────────

function Step2({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<TimesData>({
    resolver: zodResolver(timesSchema),
    defaultValues: { checkInTime: '14:00', checkOutTime: '11:00' },
  });

  const onSubmit = async (data: TimesData) => {
    setSaving(true);
    try {
      await tenantApi.update(data);
      onNext();
    } catch {
      toast({ title: 'Error', description: 'Failed to save. Try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const PRESET_CHECKINS = ['12:00', '13:00', '14:00', '15:00', '16:00'];
  const PRESET_CHECKOUTS = ['10:00', '11:00', '12:00', '13:00'];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Check-in Time</label>
          <Input {...register('checkInTime')} type="time" className={`mb-2 ${errors.checkInTime ? 'border-red-400' : ''}`} />
          {errors.checkInTime && <p className="text-red-500 text-xs">{errors.checkInTime.message}</p>}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {PRESET_CHECKINS.map(t => (
              <button key={t} type="button" onClick={() => (document.querySelector('input[name="checkInTime"]') as HTMLInputElement)!.value = t}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-200 hover:border-[#1a6b5e] hover:text-[#1a6b5e] transition-colors">
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Check-out Time</label>
          <Input {...register('checkOutTime')} type="time" className={`mb-2 ${errors.checkOutTime ? 'border-red-400' : ''}`} />
          {errors.checkOutTime && <p className="text-red-500 text-xs">{errors.checkOutTime.message}</p>}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {PRESET_CHECKOUTS.map(t => (
              <button key={t} type="button" onClick={() => (document.querySelector('input[name="checkOutTime"]') as HTMLInputElement)!.value = t}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-200 hover:border-[#1a6b5e] hover:text-[#1a6b5e] transition-colors">
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#f0faf8] border border-[#a8d5cf] rounded-xl p-4 text-sm text-[#1a6b5e]">
        💡 You can always change these later in Settings → Property
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button type="submit" disabled={saving} className="flex-1 bg-[#1a6b5e] hover:bg-[#145a4f] text-white">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : <>Save & Continue <ChevronRight className="w-4 h-4 ml-1" /></>}
        </Button>
      </div>
    </form>
  );
}

// ── Step 3: First Room ────────────────────────────────────────────────────────

function Step3({ onNext, onBack, onSkip }: { onNext: () => void; onBack: () => void; onSkip: () => void }) {
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<RoomData>({
    resolver: zodResolver(roomSchema),
    defaultValues: { type: 'STANDARD', maxOccupancy: 2, floor: 1 },
  });

  const onSubmit = async (data: RoomData) => {
    setSaving(true);
    try {
      await roomsApi.create({
        ...data,
        hireDate: undefined,
        isActive: true,
      });
      onNext();
    } catch {
      toast({ title: 'Error', description: 'Failed to add room. You can add rooms later.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Room Name</label>
          <Input {...register('name')} placeholder="Deluxe Ocean View" className={errors.name ? 'border-red-400' : ''} />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Room Number</label>
          <Input {...register('number')} placeholder="101" className={errors.number ? 'border-red-400' : ''} />
          {errors.number && <p className="text-red-500 text-xs mt-1">{errors.number.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Room Type</label>
          <select {...register('type')} className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b5e]">
            {ROOM_TYPES.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Occupancy</label>
          <Input {...register('maxOccupancy')} type="number" min={1} placeholder="2" className={errors.maxOccupancy ? 'border-red-400' : ''} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Base Price / Night</label>
          <Input {...register('basePrice')} type="number" min={0} step="0.01" placeholder="5000" className={errors.basePrice ? 'border-red-400' : ''} />
          {errors.basePrice && <p className="text-red-500 text-xs mt-1">{errors.basePrice.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Floor</label>
          <Input {...register('floor')} type="number" min={0} placeholder="1" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea {...register('description')} rows={2}
          placeholder="Spacious room with ocean view and private balcony..."
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b5e] resize-none"
        />
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-[0_0_auto] px-4">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button type="submit" disabled={saving} className="flex-1 bg-[#1a6b5e] hover:bg-[#145a4f] text-white">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Adding...</> : <>Add Room & Finish <CheckCircle className="w-4 h-4 ml-1.5" /></>}
        </Button>
        <Button type="button" variant="outline" onClick={onSkip} className="flex-[0_0_auto] px-4 text-gray-400 hover:text-gray-600">
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-center text-xs text-gray-400">Skip to add rooms later from the dashboard</p>
    </form>
  );
}

// ── Done Screen — the "aha" moment: live site + WhatsApp share ────────────────
// This is the highest-leverage screen in the whole wizard: the owner's site is
// ALREADY live (WebsiteContent is created at signup), so the job here isn't to
// say "you're done" — it's to get them to share the link with a real guest in
// the next 60 seconds. First real booking = the owner never churns.

function DoneScreen({ onGo, slug, resortName, requiresCheckout }: { onGo: () => void; slug?: string; resortName?: string; requiresCheckout: boolean }) {
  const [copied, setCopied] = useState(false);
  // Bangla only for Bangladesh visitors (locale is auto-set by middleware from
  // CF-IPCountry, or by explicit user toggle) — everyone else sees English.
  const locale = useLocale();
  const isBn = locale === 'bn';
  const siteUrl = slug ? `https://${slug}.resortpro.site` : '';
  const name = resortName ?? (isBn ? 'আমাদের রিসোর্ট' : 'our resort');

  const shareMessage = isBn
    ? `আসসালামু আলাইকুম! 🏨\n\n${name}-এ এখন সরাসরি অনলাইনে বুকিং দিতে পারবেন — bKash-এ advance payment করে রুম কনফার্ম করুন:\n\n${siteUrl}`
    : `Hi! 🏨\n\nYou can now book directly with ${name} online — secure your room with an instant payment:\n\n${siteUrl}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

  const copyLink = () => {
    navigator.clipboard.writeText(siteUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="text-center py-2">
      <div className="w-20 h-20 bg-gradient-to-br from-[#1a6b5e] to-[#145a4f] rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg">
        <CheckCircle className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1.5">
        {isBn ? <>আপনার সাইট এখন LIVE! 🎉</> : <>Your site is LIVE! 🎉</>}
      </h2>
      <p className="text-gray-500 mb-6">
        {isBn
          ? 'এখনই আপনার পুরনো গেস্টদের এই লিংক পাঠান — প্রথম অনলাইন বুকিংটাই সবচেয়ে গুরুত্বপূর্ণ।'
          : 'Share this link with a guest right now — your first online booking is the one that counts.'}
      </p>

      {/* Live URL card */}
      {siteUrl && (
        <div className="flex items-center gap-2 rounded-xl border border-[#a8d5cf] bg-[#f0faf8] px-4 py-3 mb-4">
          <span className="flex-1 truncate text-left text-sm font-semibold text-[#1a6b5e]">{siteUrl}</span>
          <button
            onClick={copyLink}
            title="Copy link"
            className="flex shrink-0 items-center gap-1 rounded-lg border border-[#a8d5cf] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1a6b5e] transition-colors hover:bg-[#e7f5f2]"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? (isBn ? 'কপি হয়েছে' : 'Copied') : (isBn ? 'কপি' : 'Copy')}
          </button>
          <a
            href={siteUrl} target="_blank" rel="noopener noreferrer"
            title="Open site"
            className="flex shrink-0 items-center gap-1 rounded-lg border border-[#a8d5cf] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1a6b5e] transition-colors hover:bg-[#e7f5f2]"
          >
            <ExternalLink className="h-3.5 w-3.5" /> {isBn ? 'খুলুন' : 'Open'}
          </a>
        </div>
      )}

      {/* The main event: WhatsApp share */}
      <a
        href={whatsappHref}
        target="_blank" rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#25D366] px-6 py-3.5 text-base font-semibold text-white shadow-md transition-transform hover:scale-[1.01] hover:shadow-lg"
      >
        <MessageCircle className="h-5 w-5" />
        {isBn ? 'WhatsApp-এ বুকিং লিংক শেয়ার করুন' : 'Share booking link on WhatsApp'}
      </a>
      <p className="text-xs text-gray-400 mt-2 mb-6">
        {isBn
          ? 'আপনার guest group বা পরিচিতদের পাঠান — sign up ছাড়াই তারা বুক করতে পারবে'
          : 'Send it to your guest contacts or groups — no sign-up needed for them to book'}
      </p>

      <button onClick={onGo} className="text-sm font-medium text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors">
        {requiresCheckout
          ? (isBn ? 'পেমেন্ট সম্পন্ন করুন' : 'Continue to secure checkout')
          : (isBn ? 'Dashboard-এ যান' : 'Go to Dashboard')}
      </button>
    </div>
  );
}

// ── Main Onboarding Page ──────────────────────────────────────────────────────

const STEPS = ['property', 'times', 'room', 'done'] as const;

const STEP_META = [
  { title: 'Tell us about your property', subtitle: 'Add your contact info and location' },
  { title: 'Set your check-in times', subtitle: 'When do guests arrive and leave?' },
  { title: 'Add your first room', subtitle: 'You can add more rooms later' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, tenant } = useAuthStore();
  const [step, setStep] = useState(0); // 0=property, 1=times, 2=room, 3=done
  const [leaving, setLeaving] = useState(false);

  const goNext = () => setStep(s => s + 1);
  const goBack = () => setStep(s => s - 1);
  const finishSetup = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await tenantApi.completeOnboarding();
      if (tenant?.planStatus !== 'incomplete') {
        router.push('/dashboard');
        return;
      }
      const checkout = await billingApi.createCheckout(tenant.plan);
      window.location.assign(checkout.data.data.url);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Your setup could not be completed. Please try again.';
      toast({ title: 'Setup needs attention', description: message, variant: 'destructive' });
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-start justify-center p-4 pt-12">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1a6b5e] text-white font-bold text-xl mb-4 shadow-md">R</div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.firstName || 'there'}! 👋
          </h1>
          <p className="text-gray-500 mt-1">Let's set up <strong>{tenant?.name}</strong> in just a few steps</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {step < 3 && <StepBar current={step} total={3} />}

          {step < 3 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">{STEP_META[step].title}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{STEP_META[step].subtitle}</p>
            </div>
          )}

          {step === 0 && <Step1 onNext={goNext} />}
          {step === 1 && <Step2 onNext={goNext} onBack={goBack} />}
          {step === 2 && <Step3 onNext={goNext} onBack={goBack} onSkip={goNext} />}
          {step === 3 && <DoneScreen onGo={finishSetup} slug={tenant?.slug} resortName={tenant?.name} requiresCheckout={tenant?.planStatus === 'incomplete'} />}
        </div>

        {/* Footer skip */}
        {step < 3 && (
          <p className="text-center mt-4 text-sm text-gray-400">
            <button onClick={finishSetup} disabled={leaving} className="hover:text-gray-600 underline underline-offset-2 transition-colors disabled:opacity-50">
              {tenant?.planStatus === 'incomplete' ? 'Skip setup — continue to checkout' : 'Skip setup — go to dashboard'}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
