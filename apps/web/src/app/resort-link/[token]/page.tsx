'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { resortGroupApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { ResortLinkDecision, type LinkRequest } from '@/components/dashboard/ResortLinkDecision';

/**
 * What the link in the approval email opens.
 *
 * The token in the URL is only a lookup key — the API will not resolve it
 * unless the person asking is signed in as this resort's owner. So a forwarded
 * email opens nothing here, and there is deliberately no way to answer the
 * request from this page without that sign-in.
 *
 * Someone who is not signed in is sent to the ordinary login, not back here
 * afterwards: the same request is waiting as a banner on their dashboard, which
 * is one fewer redirect to get wrong.
 */
export default function ResortLinkPage({ params }: { params: { token: string } }) {
  const t = useTranslations('common') as (key: string) => string;
  const say = (key: string, fallback: string) => {
    const value = t(`resortLink.${key}`);
    return value.endsWith(`resortLink.${key}`) ? fallback : value;
  };

  const token = useAuthStore((s) => s.token);
  const { data, error, isLoading } = useQuery({
    queryKey: ['resort-link-token', params.token],
    queryFn: () => resortGroupApi.byToken(params.token).then((r) => r.data.data as LinkRequest & { resortName: string }),
    enabled: !!token,
    retry: false,
  });

  const status = (error as { response?: { status?: number } } | null)?.response?.status;

  const frame = (children: React.ReactNode) => (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <div className="rounded-rp-card border border-rp-border bg-rp-surface p-6 shadow-rp-card">
        {children}
      </div>
    </main>
  );

  if (!token) {
    return frame(
      <>
        <h1 className="text-rp-heading font-semibold text-rp-text">
          {say('signInTitle', 'Sign in to answer this')}
        </h1>
        <p className="mt-2 text-rp-body text-rp-muted">
          {say('signInBody', 'Only this resort’s owner can answer a request about it. Sign in and it will be waiting on your dashboard.')}
        </p>
        <Link
          href="/auth/login"
          className="mt-5 inline-block rounded-rp-btn bg-rp-brand px-4 py-2 text-rp-body font-semibold text-white"
        >
          {say('signIn', 'Sign in')}
        </Link>
      </>,
    );
  }

  if (isLoading) {
    return frame(<p className="text-rp-body text-rp-muted">{say('loading', 'Loading…')}</p>);
  }

  if (status === 410) {
    return frame(
      <>
        <h1 className="text-rp-heading font-semibold text-rp-text">
          {say('goneTitle', 'This request is closed')}
        </h1>
        <p className="mt-2 text-rp-body text-rp-muted">
          {say('goneBody', 'It has either been answered already or expired. Ask them to send it again.')}
        </p>
      </>,
    );
  }

  if (error || !data) {
    return frame(
      <>
        <h1 className="text-rp-heading font-semibold text-rp-text">
          {say('wrongAccountTitle', 'This link is not for this account')}
        </h1>
        <p className="mt-2 text-rp-body text-rp-muted">
          {say('wrongAccountBody', 'Sign in as the owner of the resort the request is about, then open the link again.')}
        </p>
        <Link href="/dashboard" className="mt-5 inline-block text-rp-body text-rp-brand underline-offset-2 hover:underline">
          {say('backToDashboard', 'Back to the dashboard')}
        </Link>
      </>,
    );
  }

  return frame(
    <>
      <h1 className="text-rp-heading font-semibold text-rp-text">
        {say('title', 'A request about')} {data.resortName}
      </h1>
      <p className="mt-1 mb-5 text-rp-meta text-rp-muted">{data.groupName}</p>
      <ResortLinkDecision request={data} />
    </>,
  );
}
