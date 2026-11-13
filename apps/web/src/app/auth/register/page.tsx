'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Gift, Zap, Crown, ArrowLeft, CreditCard } from 'lucide-react';
import { PLAN_PRICING } from '@resort-pro/types';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { MarketingAuthShell } from '@/components/auth/MarketingAuthShell';

const PLAN_META: Record<string, { label: string; icon: React.ElementType; desc: string }> = {
  FREE:          { label: PLAN_PRICING.FREE.displayName,         icon: CreditCard, desc: `$${PLAN_PRICING.FREE.monthlyUsd}/mo · Up to ${PLAN_PRICING.FREE.roomLimit} rooms` },
  STARTER:       { label: PLAN_PRICING.STARTER.displayName,      icon: Zap,        desc: `$${PLAN_PRICING.STARTER.monthlyUsd}/mo · Up to ${PLAN_PRICING.STARTER.roomLimit} rooms` },
  PROFESSIONAL:  { label: PLAN_PRICING.PROFESSIONAL.displayName, icon: Crown,      desc: `$${PLAN_PRICING.PROFESSIONAL.monthlyUsd}/mo · Up to ${PLAN_PRICING.PROFESSIONAL.roomLimit} rooms` },
};

const schema = z.object({
  resortName: z.string().min(2, 'Resort name must be at least 2 characters'),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  firstName: z.string().min(1, 'First name required'),
  lastName: z.string().min(1, 'Last name required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'At least 8 characters').regex(/(?=.*[A-Z])/, 'Must contain uppercase').regex(/(?=.*[0-9])/, 'Must contain a number'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match',
});

type FormData = z.infer<typeof schema>;

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referrerName, setReferrerName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string>('FREE');

  // Capture ?ref= and ?plan= from URL on mount
  useEffect(() => {
    const ref  = searchParams.get('ref');
    const plan = searchParams.get('plan');
    if (plan && PLAN_META[plan]) setSelectedPlan(plan);
    if (!ref) return;
    const code = ref.toUpperCase();
    setReferralCode(code);
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    fetch(`${API_URL}/api/auth/referrer?code=${code}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data?.name) setReferrerName(d.data.name); })
      .catch(() => {});
  }, [searchParams]);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const resortName = watch('resortName');
  const slug = watch('slug');

  // Live slug availability — same resort name twice must never dead-end the
  // signup at submit time; suggest a free alternative while they're still typing.
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [slugSuggestion, setSlugSuggestion] = useState<string | null>(null);

  const handleResortNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setValue('resortName', name);
    setValue('slug', name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  };

  useEffect(() => {
    const base = (slug || '').trim();
    if (base.length < 2) {
      setSlugStatus('idle');
      setSlugSuggestion(null);
      return;
    }
    setSlugStatus('checking');
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const timer = setTimeout(() => {
      fetch(`${API_URL}/api/auth/check-slug?slug=${encodeURIComponent(base)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.data) return;
          if (d.data.available) {
            setSlugStatus('available');
            setSlugSuggestion(null);
          } else {
            setSlugStatus('taken');
            setSlugSuggestion(d.data.suggestion ?? null);
          }
        })
        .catch(() => setSlugStatus('idle'));
    }, 500);
    return () => clearTimeout(timer);
  }, [slug]);

  const useSuggestedSlug = () => {
    if (slugSuggestion) {
      setValue('slug', slugSuggestion);
      setSlugStatus('available');
      setSlugSuggestion(null);
    }
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await authApi.register({
        resortName: data.resortName,
        slug: data.slug,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        ...(referralCode && { referralCode }),
        plan: selectedPlan,
      });
      const pending = res.data.data;
      toast({ title: 'Check your email', description: 'Verify your email to continue setting up your resort.' });
      router.push(`/auth/verify-email?email=${encodeURIComponent(pending.email)}&workspace=${encodeURIComponent(pending.slug)}`);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Registration failed';
      // Race condition: the live check said available, but someone else took
      // it between then and submit — re-check and hand back a fresh suggestion
      // instead of leaving the user stuck on a bare error.
      if (status === 409) {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        try {
          const res = await fetch(`${API_URL}/api/auth/check-slug?slug=${encodeURIComponent(data.slug)}`);
          const d = await res.json();
          if (d?.data?.suggestion) {
            setSlugStatus('taken');
            setSlugSuggestion(d.data.suggestion);
          }
        } catch { /* fall through to the generic toast below */ }
        toast({ title: 'That URL was just taken', description: 'We found a similar one below — pick it and try again.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: message, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  const planMeta = PLAN_META[selectedPlan] ?? PLAN_META.FREE;
  const PlanIcon = planMeta.icon;

  return (
    <MarketingAuthShell
      eyebrow="Start simple. Grow without switching."
      title="Your resort deserves a calmer way to work."
      description="Create one workspace for bookings, rooms, guests and payments—then invite your team when you are ready."
      points={['Set up your resort in minutes', 'Choose only the capacity you need', 'Keep every guest detail together']}
    >
      <div className="w-full max-w-xl py-4 lg:py-8">

        {/* Back to plans */}
        <div className="mb-8 flex items-center justify-between">
          <a href="/plans" className="flex items-center gap-1.5 text-sm font-bold text-slate-500 transition-colors hover:text-resort-900">
            <ArrowLeft className="h-4 w-4" />
            Change plan
          </a>
          <a href="/auth/login" className="text-sm font-bold text-slate-500 transition-colors hover:text-resort-900">
            Sign in
          </a>
        </div>

        <div className="mb-7">
          <Link href="/" className="mb-8 inline-flex lg:hidden" aria-label="ResortPro home">
            <BrandLogo />
          </Link>
          <span className="block text-xs font-extrabold uppercase tracking-[0.18em] text-lime-700">Create your workspace</span>
          <h1 className="font-editorial mt-3 text-5xl font-medium leading-none tracking-[-0.035em] text-resort-900">Create your resort</h1>
          <p className="mt-3 text-slate-600">Create your workspace, then complete secure checkout.</p>
        </div>

        {/* Selected plan badge */}
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-lime-300 bg-lime-50 px-4 py-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-resort-900">
            <PlanIcon className="h-4 w-4 text-lime-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-resort-900">{planMeta.label} Plan</p>
            <p className="text-xs text-slate-500">{planMeta.desc}</p>
          </div>
          <a href="/plans" className="flex-shrink-0 text-xs font-bold text-slate-500 transition-colors hover:text-resort-900">
            Change
          </a>
        </div>

        {/* Referral banner */}
        {referralCode && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
            <Gift className="h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-bold text-amber-900">
                {referrerName ? `Referred by: ${referrerName}` : `Referral code: ${referralCode}`}
              </p>
              <p className="mt-0.5 text-xs text-amber-700">You were invited by a ResortPro member.</p>
            </div>
            <button onClick={() => { setReferralCode(''); setReferrerName(''); }} className="ml-auto text-xs text-amber-700 hover:text-amber-900">✕</button>
          </div>
        )}

        <div className="rounded-3xl border border-resort-900/10 bg-white p-6 shadow-[0_24px_70px_-42px_rgba(14,34,60,0.45)] sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-resort-900">Resort name</label>
              <Input
                {...register('resortName')}
                onChange={handleResortNameChange}
                placeholder="Palm Paradise Resort"
                className="h-11 rounded-xl border-resort-900/10 bg-[#f8f6f1] px-4 text-resort-900 placeholder:text-slate-400 focus-visible:ring-lime-400"
              />
              {errors.resortName && <p className="mt-1 text-xs text-red-400">{errors.resortName.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-resort-900">
                Resort URL slug
                <span className="ml-2 text-xs font-normal text-slate-400">your-resort.resortpro.site</span>
              </label>
              <Input
                {...register('slug')}
                placeholder="palm-paradise-resort"
                className="h-11 rounded-xl border-resort-900/10 bg-[#f8f6f1] px-4 font-mono text-resort-900 placeholder:text-slate-400 focus-visible:ring-lime-400"
              />
              {errors.slug && <p className="mt-1 text-xs text-red-400">{errors.slug.message}</p>}
              {!errors.slug && slugStatus === 'checking' && (
                <p className="mt-1 text-xs text-slate-400">Checking availability…</p>
              )}
              {!errors.slug && slugStatus === 'available' && (
                <p className="mt-1 text-xs text-emerald-400">✓ Available</p>
              )}
              {!errors.slug && slugStatus === 'taken' && (
                <p className="mt-1 text-xs text-amber-400">
                  That name is already taken.
                  {slugSuggestion && (
                    <>
                      {' '}Try{' '}
                      <button type="button" onClick={useSuggestedSlug} className="font-mono font-bold text-resort-900 underline decoration-lime-400 decoration-2">
                        {slugSuggestion}
                      </button>{' '}
                      instead?
                    </>
                  )}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-resort-900">First name</label>
                <Input {...register('firstName')} placeholder="Alex" className="h-11 rounded-xl border-resort-900/10 bg-[#f8f6f1] px-4 text-resort-900 placeholder:text-slate-400 focus-visible:ring-lime-400" />
                {errors.firstName && <p className="mt-1 text-xs text-red-400">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold text-resort-900">Last name</label>
                <Input {...register('lastName')} placeholder="Johnson" className="h-11 rounded-xl border-resort-900/10 bg-[#f8f6f1] px-4 text-resort-900 placeholder:text-slate-400 focus-visible:ring-lime-400" />
                {errors.lastName && <p className="mt-1 text-xs text-red-400">{errors.lastName.message}</p>}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-resort-900">Email</label>
              <Input {...register('email')} type="email" placeholder="you@yourresort.com" className="h-11 rounded-xl border-resort-900/10 bg-[#f8f6f1] px-4 text-resort-900 placeholder:text-slate-400 focus-visible:ring-lime-400" />
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-resort-900">Password</label>
              <Input {...register('password')} type="password" placeholder="••••••••" className="h-11 rounded-xl border-resort-900/10 bg-[#f8f6f1] px-4 text-resort-900 placeholder:text-slate-400 focus-visible:ring-lime-400" />
              {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
              <p className="mt-1 text-xs text-slate-400">Min. 8 chars, one uppercase, one number</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-resort-900">Confirm password</label>
              <Input {...register('confirmPassword')} type="password" placeholder="Repeat your password" className="h-11 rounded-xl border-resort-900/10 bg-[#f8f6f1] px-4 text-resort-900 placeholder:text-slate-400 focus-visible:ring-lime-400" />
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>}
            </div>

            <Button type="submit" size="lg" className="mt-2 h-12 w-full rounded-full bg-resort-900 font-extrabold text-white shadow-none hover:bg-resort-800" loading={loading}>
              Continue to secure checkout
            </Button>
            <p className="mt-3 text-center text-xs leading-relaxed text-slate-400">
              By creating an account you agree to our{' '}
              <Link href="/terms" className="font-bold text-slate-600 underline hover:text-resort-900">Terms</Link>{' '}
              and{' '}
              <Link href="/privacy" className="font-bold text-slate-600 underline hover:text-resort-900">Privacy Policy</Link>.
            </p>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/auth/login" className="font-extrabold text-resort-900 underline decoration-lime-400 decoration-2 underline-offset-4">Sign in</Link>
          </p>
        </div>
      </div>
    </MarketingAuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
