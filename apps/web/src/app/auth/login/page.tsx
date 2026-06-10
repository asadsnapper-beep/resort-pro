'use client';

import { useState } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const t = useTranslations('auth.login');
  const locale = useLocale() as Locale;

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setLoginError(null);
    try {
      const res = await authApi.login(data);
      const { user, tenant, token, refreshToken } = res.data.data;
      setAuth(user, tenant, token, refreshToken);
      toast({ title: t('title'), description: `${user.firstName}`, variant: 'default' });
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('invalidCredentials');
      setLoginError(message);
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
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
