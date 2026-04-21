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

const schema = z.object({
  resortName: z.string().min(2, 'Resort name must be at least 2 characters'),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  firstName: z.string().min(1, 'First name required'),
  lastName: z.string().min(1, 'Last name required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'At least 8 characters').regex(/(?=.*[A-Z])/, 'Must contain uppercase').regex(/(?=.*[0-9])/, 'Must contain a number'),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

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
      const res = await authApi.register(data);
      const { user, tenant, token, refreshToken } = res.data.data;
      setAuth(user, tenant, token, refreshToken);
      toast({ title: 'Resort created!', description: `Welcome to ResortPro, ${user.firstName}!` });
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Registration failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-resort-900 to-resort-700 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500 font-display text-2xl font-bold text-resort-900">R</div>
          <h1 className="font-display text-3xl font-bold text-white">Create your resort</h1>
          <p className="mt-2 text-white/60">Free for 3 months. No credit card needed.</p>
        </div>

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
                <span className="ml-2 text-white/40 font-normal text-xs">your-resort.resortpro.com</span>
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
