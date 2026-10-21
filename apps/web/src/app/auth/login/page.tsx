'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ArrowLeft } from 'lucide-react';
import { useLocale } from 'next-intl';
import type { Locale } from '@/i18n/config';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { MarketingAuthShell } from '@/components/auth/MarketingAuthShell';

// Window.resortpro type is declared globally in src/types/electron.d.ts

const schema = z.object({
  slug: z.string().min(1, 'Resort slug required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});

type FormData = {
  slug: string;
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [loading, setLoading]           = useState(false);
  const [loginError, setLoginError]     = useState<string | null>(null);
  const t = useTranslations('auth.login');
  const locale = useLocale() as Locale;

  // Biometric state (Electron only)
  const [isElectron, setIsElectron]           = useState(false);
  const [biometricAvail, setBiometricAvail]   = useState(false);
  const [hasSavedCreds, setHasSavedCreds]     = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showSavePrompt, setShowSavePrompt]   = useState(false);
  const [lastLoginData, setLastLoginData]     = useState<FormData | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.resortpro?.isElectron) return;
    setIsElectron(true);
    Promise.all([
      window.resortpro.biometricAvailable(),
      window.resortpro.hasSavedCredentials(),
    ]).then(([avail, hasCreds]) => {
      setBiometricAvail(avail);
      setHasSavedCreds(hasCreds);
    });
  }, []);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Welcome emails carry the workspace as a query parameter so a new owner
  // lands on the standard sign-in screen without having to decipher or type a
  // tenant slug. The value remains editable for shared-device sign-ins.
  useEffect(() => {
    const workspace = searchParams.get('workspace');
    if (workspace) setValue('slug', workspace);
  }, [searchParams, setValue]);

  // Login with credentials (regular flow)
  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setLoginError(null);
    try {
      const res = await authApi.login(data);
      const { user, tenant, token, refreshToken } = res.data.data;
      setAuth(user, tenant, token, refreshToken);
      toast({ title: t('title'), description: `${user.firstName}`, variant: 'default' });

      // Electron: offer to save credentials for biometric login
      if (isElectron && biometricAvail && !hasSavedCreds) {
        setLastLoginData(data);
        setShowSavePrompt(true);
        return; // don't navigate yet — wait for user choice
      }

      router.push(tenant.onboardingCompletedAt ? '/dashboard' : '/onboarding');
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { error?: string; code?: string } } })?.response?.data;
      if (apiError?.code === 'EMAIL_VERIFICATION_REQUIRED') {
        router.push(`/auth/verify-email?email=${encodeURIComponent(data.email)}&workspace=${encodeURIComponent(data.slug)}`);
        return;
      }
      const message = apiError?.error || t('invalidCredentials');
      setLoginError(message);
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Login via Touch ID / Windows Hello
  const handleBiometricLogin = async () => {
    if (!window.resortpro) return;
    setBiometricLoading(true);
    try {
      const result = await window.resortpro.authenticateBiometric();
      if (!result.success || !result.creds) {
        toast({ title: 'Biometric failed', description: result.error ?? 'Could not verify identity', variant: 'destructive' });
        return;
      }
      // Use the decrypted credentials to login
      const res = await authApi.login(result.creds);
      const { user, tenant, token, refreshToken } = res.data.data;
      setAuth(user, tenant, token, refreshToken);
      toast({ title: 'Welcome back!', description: user.firstName });
      router.push(tenant.onboardingCompletedAt ? '/dashboard' : '/onboarding');
    } catch {
      toast({ title: 'Login failed', variant: 'destructive' });
    } finally {
      setBiometricLoading(false);
    }
  };

  // Save credentials and go to dashboard
  const handleSaveCredentials = async () => {
    if (!window.resortpro || !lastLoginData) return;
    await window.resortpro.saveCredentials(lastLoginData);
    setHasSavedCreds(true);
    setShowSavePrompt(false);
    toast({ title: 'Touch ID enabled', description: 'You can login with Touch ID next time' });
    const currentTenant = useAuthStore.getState().tenant;
    router.push(currentTenant?.onboardingCompletedAt ? '/dashboard' : '/onboarding');
  };

  return (
    <MarketingAuthShell
      eyebrow="Your resort, one clear view"
      title="Calmer operations start here."
      description="Pick up exactly where your team left off—bookings, rooms, guests and payments are ready in one place."
      points={['One dashboard for the whole team', 'Works on phone and computer', 'Your resort data stays protected']}
    >
      <div className="w-full max-w-md">
        <div className="absolute inset-x-5 top-5 flex items-center justify-between sm:inset-x-8 lg:inset-x-12 lg:top-8">
          {!isElectron ? (
            <Link href="/" className="flex items-center gap-1.5 text-sm font-bold text-slate-500 transition-colors hover:text-resort-900">
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>
          ) : <span />}
          <LanguageSwitcher
            currentLocale={locale}
            variant="button"
            className="!text-slate-500 hover:!bg-white hover:!text-resort-900"
          />
        </div>

        <Link href="/" className="mb-8 inline-flex lg:hidden" aria-label="ResortPro home">
          <BrandLogo />
        </Link>
        <div className="mb-8">
          <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-lime-700">Secure sign in</span>
          <h1 className="font-editorial mt-3 text-5xl font-medium leading-none tracking-[-0.035em] text-resort-900">{t('title')}</h1>
          <p className="mt-3 text-slate-600">{t('subtitle')}</p>
        </div>

        <div className="rounded-3xl border border-resort-900/10 bg-white p-6 shadow-[0_24px_70px_-42px_rgba(14,34,60,0.45)] sm:p-8">

          {/* ── Save credentials prompt (after first login) ─────────────── */}
          {showSavePrompt && (
            <div className="mb-6 space-y-3 rounded-2xl border border-lime-300 bg-lime-50 p-5 text-center">
              <div className="text-3xl">🔐</div>
              <p className="font-bold text-resort-900">Enable Touch ID?</p>
              <p className="text-sm text-slate-600">
                Login next time with just your fingerprint — no password needed.
              </p>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setShowSavePrompt(false); router.push('/dashboard'); }}
                  className="flex-1 rounded-full border border-resort-900/15 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Not now
                </button>
                <button
                  onClick={handleSaveCredentials}
                  className="flex-1 rounded-full bg-resort-900 py-2 text-sm font-bold text-white transition-colors hover:bg-resort-800"
                >
                  Enable Touch ID
                </button>
              </div>
            </div>
          )}

          {/* ── Touch ID button (if credentials are saved) ──────────────── */}
          {isElectron && biometricAvail && hasSavedCreds && !showSavePrompt && (
            <div className="mb-6 space-y-3">
              <button
                onClick={handleBiometricLogin}
                disabled={biometricLoading}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-resort-900/10 bg-[#f8f6f1] py-3.5 font-bold text-resort-900 transition-colors hover:bg-lime-50 disabled:opacity-50"
              >
                {biometricLoading ? (
                  <span className="text-sm">Verifying…</span>
                ) : (
                  <>
                    <span className="text-2xl">🔐</span>
                    <span>Login with Touch ID</span>
                  </>
                )}
              </button>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-resort-900/10" />
                <span className="text-xs text-slate-400">or use password</span>
                <div className="h-px flex-1 bg-resort-900/10" />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-resort-900">Resort slug</label>
              <Input
                {...register('slug')}
                placeholder="your-resort-name"
                className="h-11 rounded-xl border-resort-900/10 bg-[#f8f6f1] px-4 text-resort-900 placeholder:text-slate-400 focus-visible:ring-lime-400"
              />
              {errors.slug && <p className="mt-1 text-xs text-red-400">{errors.slug.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-resort-900">{t('email')}</label>
              <Input
                {...register('email')}
                type="email"
                placeholder="owner@yourresort.com"
                className="h-11 rounded-xl border-resort-900/10 bg-[#f8f6f1] px-4 text-resort-900 placeholder:text-slate-400 focus-visible:ring-lime-400"
              />
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-resort-900">{t('password')}</label>
              <Input
                {...register('password')}
                type="password"
                placeholder="••••••••"
                className="h-11 rounded-xl border-resort-900/10 bg-[#f8f6f1] px-4 text-resort-900 placeholder:text-slate-400 focus-visible:ring-lime-400"
              />
              {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
            </div>
            {loginError && (
              <p className="text-sm text-red-400 text-center" role="alert">{loginError}</p>
            )}
            <Button type="submit" size="lg" className="h-12 w-full rounded-full bg-resort-900 font-extrabold text-white shadow-none hover:bg-resort-800" loading={loading}>
              {loading ? t('signingIn') : t('signIn')}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link href="/auth/forgot-password" className="text-sm font-bold text-slate-500 transition-colors hover:text-resort-900">
              {t('forgotPassword')}
            </Link>
          </div>
          <p className="mt-4 text-center text-sm text-slate-500">
            {t('noAccount')}{' '}
            <Link href="/auth/register" className="font-extrabold text-resort-900 underline decoration-lime-400 decoration-2 underline-offset-4">
              {t('signUp')}
            </Link>
          </p>
        </div>
      </div>
    </MarketingAuthShell>
  );
}
