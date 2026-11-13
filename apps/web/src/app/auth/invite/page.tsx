'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/hooks/use-toast';
import { Users, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { PublicStatusShell, publicFieldClass, publicPrimaryButtonClass } from '@/components/brand/PublicStatusShell';

const schema = z.object({
  firstName: z.string().min(1, 'First name required'),
  lastName: z.string().min(1, 'Last name required'),
  password: z.string().min(8, 'At least 8 characters').regex(/(?=.*[A-Z])/, 'Must have uppercase').regex(/(?=.*[0-9])/, 'Must have number'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
type FormData = z.infer<typeof schema>;

type InviteInfo = {
  email: string;
  role: string;
  tenant: { name: string; slug: string; logoUrl?: string };
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function InviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const { setAuth } = useAuthStore();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    fetch(`${API}/api/auth/invite/${token}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) { setInvite(json.data); setStatus('valid'); }
        else setStatus('invalid');
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const onSubmit = async (data: FormData) => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/auth/invite/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, firstName: data.firstName, lastName: data.lastName, password: data.password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to accept invite');
      const { user, tenant, token: authToken, refreshToken } = json.data;
      setAuth(user, tenant, authToken, refreshToken);
      toast({ title: `Welcome to ${invite?.tenant.name}!`, description: 'Your account has been created.' });
      router.push('/dashboard');
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Something went wrong', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-lime-600" />
        <p className="text-gray-500 text-sm">Validating invite...</p>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="py-6 text-center">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Invalid or Expired Invite</h3>
        <p className="text-gray-500 text-sm mb-6">This invite link is no longer valid. Please ask your manager to send a new invite.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-lime-200 bg-lime-50 p-4">
        <p className="text-sm text-resort-900">
          You've been invited to join <strong>{invite?.tenant.name}</strong> as a{' '}
          <span className="capitalize font-semibold">{invite?.role.toLowerCase()}</span>
        </p>
        <p className="mt-1 text-xs text-resort-900/60">{invite?.email}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-resort-900">First name</label>
            <Input {...register('firstName')} placeholder="John" className={`${publicFieldClass} ${errors.firstName ? 'border-red-400' : ''}`} />
            {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-resort-900">Last name</label>
            <Input {...register('lastName')} placeholder="Smith" className={`${publicFieldClass} ${errors.lastName ? 'border-red-400' : ''}`} />
            {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-bold text-resort-900">Password</label>
          <div className="relative">
            <Input
              {...register('password')}
              type={showPw ? 'text' : 'password'}
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              className={`${publicFieldClass} pr-10 ${errors.password ? 'border-red-400' : ''}`}
            />
            <button type="button" onClick={() => setShowPw(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-bold text-resort-900">Confirm password</label>
          <Input
            {...register('confirmPassword')}
            type={showPw ? 'text' : 'password'}
            placeholder="Repeat password"
            className={`${publicFieldClass} ${errors.confirmPassword ? 'border-red-400' : ''}`}
          />
          {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
        </div>

        <Button type="submit" disabled={submitting} className={`mt-2 ${publicPrimaryButtonClass}`}>
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating account...</> : 'Accept Invite & Join'}
        </Button>
      </form>
    </div>
  );
}

export default function InvitePage() {
  return (
    <PublicStatusShell eyebrow="Team invitation" title="Join your resort team." description="Create your secure staff account and step straight into the shared workspace." icon={<Users className="h-6 w-6" />}>
      <Suspense fallback={<div className="py-8 text-center text-slate-400">Loading…</div>}>
        <InviteForm />
      </Suspense>
    </PublicStatusShell>
  );
}
