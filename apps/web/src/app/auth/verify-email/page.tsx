'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, Mail } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { PublicStatusShell, publicPrimaryButtonClass } from '@/components/brand/PublicStatusShell';

type Status = 'waiting' | 'verifying' | 'verified' | 'error';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const token = searchParams.get('token');
  const email = searchParams.get('email') ?? '';
  const workspace = searchParams.get('workspace') ?? '';
  const started = useRef(false);
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'waiting');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    authApi.verifyEmail(token)
      .then((response) => {
        const { user, tenant, token: accessToken } = response.data.data;
        setAuth(user, tenant, accessToken);
        setStatus('verified');
        setMessage('Email verified. Taking you to resort setup…');
        router.replace('/onboarding');
      })
      .catch((error: unknown) => {
        setStatus('error');
        setMessage((error as { response?: { data?: { error?: string } } })?.response?.data?.error
          ?? 'This verification link is invalid or expired.');
      });
  }, [router, setAuth, token]);

  const resend = async () => {
    if (!email || !workspace) return;
    setResending(true);
    try {
      await authApi.resendVerification({ email, slug: workspace });
      toast({ title: 'Verification email sent', description: 'Please check your inbox and spam folder.' });
    } catch (error: unknown) {
      toast({
        title: 'Could not resend email',
        description: (error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Please try again shortly.',
        variant: 'destructive',
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <PublicStatusShell eyebrow="Email security" title={status === 'verified' ? 'Email verified.' : status === 'error' ? 'Link needs attention.' : 'Verify your email.'} description="One quick check keeps your resort workspace and guest data protected." icon={status === 'verified' ? <CheckCircle className="h-6 w-6" /> : <Mail className="h-6 w-6" />}>
      <section className="text-center">
        <h2 className="text-lg font-extrabold text-resort-900">
          {status === 'waiting' && 'Verify your email'}
          {status === 'verifying' && 'Verifying your email'}
          {status === 'verified' && 'Email verified'}
          {status === 'error' && 'Verification link problem'}
        </h2>

        {status === 'waiting' && (
          <>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              We sent a verification link to <strong className="text-resort-900">{email || 'your email address'}</strong>.
              Open it to continue with resort setup.
            </p>
            <Button type="button" className={`mt-6 ${publicPrimaryButtonClass}`} loading={resending} disabled={!email || !workspace} onClick={resend}>
              Resend verification email
            </Button>
          </>
        )}

        {(status === 'verifying' || status === 'verified') && (
          <div className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-500">
            {status === 'verifying' && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{message || 'Please wait…'}</span>
          </div>
        )}

        {status === 'error' && (
          <>
            <p role="alert" className="mt-3 text-sm leading-6 text-red-300">{message}</p>
            <Link href="/auth/login" className="mt-6 inline-block text-sm font-extrabold text-resort-900 underline decoration-lime-500 decoration-2 underline-offset-4">
              Return to sign in
            </Link>
          </>
        )}
      </section>
    </PublicStatusShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
