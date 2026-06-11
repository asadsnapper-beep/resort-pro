'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { useLocale } from 'next-intl';
import type { Locale } from '@/i18n/config';

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

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

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

      router.push('/dashboard');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('invalidCredentials');
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
      router.push('/dashboard');
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
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-resort-900 to-resort-700 flex items-center justify-center p-4">
      {/* Language switcher — top right */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher currentLocale={locale} variant="button" />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500 font-display text-2xl font-bold text-resort-900">R</div>
          <h1 className="font-display text-3xl font-bold text-white">{t('title')}</h1>
          <p className="mt-2 text-white/60">{t('subtitle')}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">

          {/* ── Save credentials prompt (after first login) ─────────────── */}
          {showSavePrompt && (
            <div className="mb-6 rounded-xl border border-gold-400/30 bg-gold-500/10 p-5 text-center space-y-3">
              <div className="text-3xl">🔐</div>
              <p className="font-semibold text-white">Enable Touch ID?</p>
              <p className="text-sm text-white/60">
                Login next time with just your fingerprint — no password needed.
              </p>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setShowSavePrompt(false); router.push('/dashboard'); }}
                  className="flex-1 rounded-lg border border-white/20 py-2 text-sm text-white/60 hover:bg-white/10 transition-colors"
                >
                  Not now
                </button>
                <button
                  onClick={handleSaveCredentials}
                  className="flex-1 rounded-lg bg-gold-500 py-2 text-sm font-semibold text-resort-900 hover:bg-gold-400 transition-colors"
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
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-white/20 bg-white/10 py-3.5 text-white font-medium hover:bg-white/15 transition-colors disabled:opacity-50"
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
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs text-white/40">or use password</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">Resort slug</label>
              <Input
                {...register('slug')}
                placeholder="your-resort-name"
                className="border-white/10 bg-white/10 text-white placeholder:text-white/30 focus-visible:ring-gold-500"
              />
              {errors.slug && <p className="mt-1 text-xs text-red-400">{errors.slug.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">{t('email')}</label>
              <Input
                {...register('email')}
                type="email"
                placeholder="owner@yourresort.com"
                className="border-white/10 bg-white/10 text-white placeholder:text-white/30 focus-visible:ring-gold-500"
              />
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">{t('password')}</label>
              <Input
                {...register('password')}
                type="password"
                placeholder="••••••••"
                className="border-white/10 bg-white/10 text-white placeholder:text-white/30 focus-visible:ring-gold-500"
              />
              {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
            </div>
            {loginError && (
              <p className="text-sm text-red-400 text-center" role="alert">{loginError}</p>
            )}
            <Button type="submit" variant="gold" size="lg" className="w-full" loading={loading}>
              {loading ? t('signingIn') : t('signIn')}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link href="/auth/forgot-password" className="text-sm text-white/50 hover:text-gold-400 transition-colors">
              {t('forgotPassword')}
            </Link>
          </div>
          <p className="mt-4 text-center text-sm text-white/50">
            {t('noAccount')}{' '}
            <Link href="/auth/register" className="text-gold-400 hover:text-gold-300 font-medium">
              {t('signUp')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
