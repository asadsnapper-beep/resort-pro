'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Gift, Zap, Crown, Building2, ArrowLeft } from 'lucide-react';
import { PLAN_PRICING } from '@resort-pro/types';

const PLAN_META: Record<string, { label: string; color: string; icon: React.ElementType; desc: string }> = {
  STARTER:      { label: PLAN_PRICING.STARTER.displayName,      color: '#1a6b5e', icon: Zap,       desc: `$${PLAN_PRICING.STARTER.monthlyUsd}/mo after trial · Up to ${PLAN_PRICING.STARTER.roomLimit} rooms` },
  PROFESSIONAL: { label: PLAN_PRICING.PROFESSIONAL.displayName, color: '#d4a853', icon: Crown,     desc: `$${PLAN_PRICING.PROFESSIONAL.monthlyUsd}/mo after trial · Up to ${PLAN_PRICING.PROFESSIONAL.roomLimit} rooms` },
  ENTERPRISE:   { label: PLAN_PRICING.ENTERPRISE.displayName,   color: '#6366f1', icon: Building2, desc: `$${PLAN_PRICING.ENTERPRISE.monthlyUsd}/mo after trial · Up to ${PLAN_PRICING.ENTERPRISE.roomLimit} rooms` },
};

const schema = z.object({
  resortName: z.string().min(2, 'Resort name must be at least 2 characters'),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  firstName: z.string().min(1, 'First name required'),
  lastName: z.string().min(1, 'Last name required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'At least 8 characters').regex(/(?=.*[A-Z])/, 'Must contain uppercase').regex(/(?=.*[0-9])/, 'Must contain a number'),
});

type FormData = z.infer<typeof schema>;

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referrerName, setReferrerName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string>('STARTER');

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

  const handleResortNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setValue('resortName', name);
    setValue('slug', name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await authApi.register({
        ...(data as Required<typeof data>),
        ...(referralCode && { referralCode }),
        plan: selectedPlan,
      });
      const { user, tenant, token, refreshToken } = res.data.data;
      setAuth(user, tenant, token, refreshToken);
      toast({ title: 'Resort created!', description: `Welcome to ResortPro, ${user.firstName}!` });
      router.push('/onboarding');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Registration failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const planMeta = PLAN_META[selectedPlan] ?? PLAN_META.STARTER;
  const PlanIcon = planMeta.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-resort-900 to-resort-700 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Back to plans */}
        <div className="mb-6 flex items-center justify-between">
          <a href="/plans" className="flex items-center gap-1.5 text-white/50 hover:text-white/80 text-sm transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Change plan
          </a>
          <a href="/auth/login" className="text-white/50 hover:text-white/80 text-sm transition-colors">
            Sign in
          </a>
        </div>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500 font-display text-2xl font-bold text-resort-900">R</div>
          <h1 className="font-display text-3xl font-bold text-white">Create your resort</h1>
          <p className="mt-2 text-white/60">14-day free trial · No credit card needed</p>
        </div>

        {/* Selected plan badge */}
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 border border-white/20">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-white/15 flex-shrink-0">
            <PlanIcon className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold">{planMeta.label} Plan — 14-day free trial</p>
            <p className="text-white/50 text-xs">{planMeta.desc}</p>
          </div>
          <a href="/plans" className="text-white/40 hover:text-white/70 text-xs transition-colors flex-shrink-0">
            Change
          </a>
        </div>

        {/* Referral banner */}
        {referralCode && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/30">
            <Gift className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <p className="text-amber-300 text-sm font-medium">
                {referrerName ? `Referred by: ${referrerName}` : `Referral code: ${referralCode}`}
              </p>
              <p className="text-amber-400/70 text-xs mt-0.5">You were invited by a ResortPro member.</p>
            </div>
            <button onClick={() => { setReferralCode(''); setReferrerName(''); }} className="ml-auto text-amber-500/60 hover:text-amber-300 text-xs">✕</button>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">Resort name</label>
              <Input
                {...register('resortName')}
                onChange={handleResortNameChange}
                placeholder="Palm Paradise Resort"
                className="border-white/10 bg-white/10 text-white placeholder:text-white/30 focus-visible:ring-gold-500"
              />
              {errors.resortName && <p className="mt-1 text-xs text-red-400">{errors.resortName.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">
                Resort URL slug
                <span className="ml-2 text-white/40 font-normal text-xs">your-resort.resortpro.site</span>
              </label>
              <Input
                {...register('slug')}
                placeholder="palm-paradise-resort"
                className="border-white/10 bg-white/10 text-white placeholder:text-white/30 focus-visible:ring-gold-500 font-mono"
              />
              {errors.slug && <p className="mt-1 text-xs text-red-400">{errors.slug.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/80">First name</label>
                <Input {...register('firstName')} placeholder="Alex" className="border-white/10 bg-white/10 text-white placeholder:text-white/30 focus-visible:ring-gold-500" />
                {errors.firstName && <p className="mt-1 text-xs text-red-400">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/80">Last name</label>
                <Input {...register('lastName')} placeholder="Johnson" className="border-white/10 bg-white/10 text-white placeholder:text-white/30 focus-visible:ring-gold-500" />
                {errors.lastName && <p className="mt-1 text-xs text-red-400">{errors.lastName.message}</p>}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">Email</label>
              <Input {...register('email')} type="email" placeholder="you@yourresort.com" className="border-white/10 bg-white/10 text-white placeholder:text-white/30 focus-visible:ring-gold-500" />
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">Password</label>
              <Input {...register('password')} type="password" placeholder="••••••••" className="border-white/10 bg-white/10 text-white placeholder:text-white/30 focus-visible:ring-gold-500" />
              {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
              <p className="mt-1 text-xs text-white/40">Min. 8 chars, one uppercase, one number</p>
            </div>

            <Button type="submit" variant="gold" size="lg" className="w-full mt-2" loading={loading}>
              Create my resort
            </Button>
            <p className="mt-3 text-center text-xs leading-relaxed text-white/40">
              By creating an account you agree to our{' '}
              <Link href="/terms" className="text-white/60 underline hover:text-white/80">Terms</Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-white/60 underline hover:text-white/80">Privacy Policy</Link>.
            </p>
          </form>
          <p className="mt-6 text-center text-sm text-white/50">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-gold-400 hover:text-gold-300 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
