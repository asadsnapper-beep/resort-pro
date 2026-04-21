'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import type { Metadata } from 'next';

const schema = z.object({
  slug: z.string().min(1, 'Resort slug required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

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
      toast({ title: 'Welcome back!', description: `Logged in as ${user.firstName}`, variant: 'default' });
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Login failed';
      setLoginError(message);
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-resort-900 to-resort-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500 font-display text-2xl font-bold text-resort-900">R</div>
          <h1 className="font-display text-3xl font-bold text-white">Welcome back</h1>
          <p className="mt-2 text-white/60">Sign in to your ResortPro dashboard</p>
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
              <label className="mb-1.5 block text-sm font-medium text-white/80">Email</label>
              <Input
                {...register('email')}
                type="email"
                placeholder="owner@yourresort.com"
                className="border-white/10 bg-white/10 text-white placeholder:text-white/30 focus-visible:ring-gold-500"
              />
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">Password</label>
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
              Sign in
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-white/50">
            No account?{' '}
            <Link href="/auth/register" className="text-gold-400 hover:text-gold-300 font-medium">
              Start free trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
