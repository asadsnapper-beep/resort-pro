'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, Mail } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

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
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-resort-900 to-resort-700 p-4">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/10 p-8 text-center backdrop-blur-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-gold-400">
          {status === 'verified' ? <CheckCircle className="h-7 w-7" /> : <Mail className="h-7 w-7" />}
        </div>
        <h1 className="font-display text-2xl font-bold text-white">
          {status === 'waiting' && 'Verify your email'}
          {status === 'verifying' && 'Verifying your email'}
          {status === 'verified' && 'Email verified'}
          {status === 'error' && 'Verification link problem'}
        </h1>

        {status === 'waiting' && (
          <>
            <p className="mt-3 text-sm leading-6 text-white/60">
              We sent a verification link to <strong className="text-white/90">{email || 'your email address'}</strong>.
              Open it to continue with resort setup.
            </p>
            <Button type="button" variant="gold" className="mt-6 w-full" loading={resending} disabled={!email || !workspace} onClick={resend}>
              Resend verification email
            </Button>
          </>
        )}

        {(status === 'verifying' || status === 'verified') && (
          <div className="mt-5 flex items-center justify-center gap-2 text-sm text-white/70">
            {status === 'verifying' && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{message || 'Please wait…'}</span>
          </div>
        )}

        {status === 'error' && (
          <>
            <p role="alert" className="mt-3 text-sm leading-6 text-red-300">{message}</p>
            <Link href="/auth/login" className="mt-6 inline-block text-sm font-medium text-gold-400 hover:text-gold-300">
              Return to sign in
            </Link>
          </>
        )}
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
