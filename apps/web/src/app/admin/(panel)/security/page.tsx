'use client';

/**
 * Two-factor and sessions, for the admin looking at it.
 *
 * The API for both shipped before this page did, which meant turning on the
 * second factor required calling endpoints by hand — so in practice nobody
 * would. This is the part that makes it something a person actually does.
 *
 * There is no QR code here on purpose: rendering one needs a library this repo
 * does not have, and a decision about adding it belongs to whoever owns the
 * dependency list. The secret is shown in the form authenticator apps accept
 * for manual entry, and the otpauth:// link works when opened on the phone
 * itself.
 */

import { useEffect, useState } from 'react';
import { adminEndpoints } from '@/lib/admin-api';
import { useAdminStore } from '@/store/admin';
import {
  ShieldCheck, ShieldAlert, Loader2, Copy, Check, KeyRound, Monitor, LogOut,
} from 'lucide-react';

interface MfaStatus {
  enabled: boolean;
  enrolmentStarted: boolean;
  recoveryCodesRemaining: number;
}

interface AdminSessionRow {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  current: boolean;
}

/** Authenticator apps accept the secret in groups of four when typed by hand. */
const inGroups = (secret: string) => secret.match(/.{1,4}/g)?.join(' ') ?? secret;

const when = (iso: string) => new Date(iso).toLocaleString();

export default function AdminSecurityPage() {
  const { clearAdmin } = useAdminStore();

  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [sessions, setSessions] = useState<AdminSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Enrolment, held only while it is happening.
  const [secret, setSecret] = useState('');
  const [otpauth, setOtpauth] = useState('');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  // Turning it off.
  const [offPassword, setOffPassword] = useState('');
  const [offCode, setOffCode] = useState('');

  const load = async () => {
    try {
      const [mfa, sess] = await Promise.all([
        adminEndpoints.mfaStatus(),
        adminEndpoints.sessions(),
      ]);
      setStatus(mfa.data.data);
      setSessions(sess.data.data.sessions);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not load your security settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  const startSetup = () => run(async () => {
    const res = await adminEndpoints.mfaSetup();
    setSecret(res.data.data.secret);
    setOtpauth(res.data.data.otpauthUri);
    setRecoveryCodes(null);
  });

  const enable = () => run(async () => {
    const res = await adminEndpoints.mfaEnable(code.trim());
    setRecoveryCodes(res.data.data.recoveryCodes);
    setSecret('');
    setOtpauth('');
    setCode('');
    await load();
  });

  const disable = () => run(async () => {
    await adminEndpoints.mfaDisable(offPassword, offCode.trim());
    setOffPassword('');
    setOffCode('');
    setNotice('Two-factor is off.');
    await load();
  });

  const revokeOthers = () => run(async () => {
    const res = await adminEndpoints.revokeOtherSessions();
    setNotice(`Signed out of ${res.data.data.revoked} other session(s).`);
    await load();
  });

  const signOutEverywhere = () => run(async () => {
    await adminEndpoints.revokeOtherSessions();
    await adminEndpoints.logout();
    clearAdmin();
    window.location.href = '/admin/login';
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-rp-brand" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-rp-text text-xl font-semibold">Security</h1>
        <p className="text-rp-muted text-sm mt-1">
          Two-factor sign-in, and where this account is signed in.
        </p>
      </div>

      {error && (
        <p className="text-sm text-rp-danger bg-rp-red-bg border border-rp-border rounded-rp-card px-4 py-3">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-sm text-rp-brand bg-rp-teal-bg border border-rp-border-md rounded-rp-card px-4 py-3">
          {notice}
        </p>
      )}

      {/* ── Recovery codes, shown once ─────────────────────────────────── */}
      {recoveryCodes && (
        <section className="bg-rp-surface border-2 border-rp-brand rounded-rp-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="w-4 h-4 text-rp-brand" />
            <h2 className="text-rp-text font-medium">Save these recovery codes</h2>
          </div>
          <p className="text-rp-muted text-sm mb-4">
            They are shown once and never again. Each one works a single time, and
            they are the only way back in if you lose the phone.
          </p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm text-rp-text mb-4">
            {recoveryCodes.map((rc) => <div key={rc}>{rc}</div>)}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { navigator.clipboard?.writeText(recoveryCodes.join('\n')); setCopied(true); }}
              className="px-3 py-2 rounded-lg text-sm bg-rp-teal-bg text-rp-brand border border-rp-border-md"
            >
              {copied ? 'Copied' : 'Copy all'}
            </button>
            <button
              type="button"
              onClick={() => { setRecoveryCodes(null); setCopied(false); }}
              className="px-3 py-2 rounded-lg text-sm text-rp-muted hover:text-rp-text"
            >
              I have saved them
            </button>
          </div>
        </section>
      )}

      {/* ── Two-factor ─────────────────────────────────────────────────── */}
      <section className="bg-rp-surface border border-rp-border rounded-rp-card p-5">
        <div className="flex items-start gap-3">
          {status?.enabled
            ? <ShieldCheck className="w-5 h-5 text-rp-brand shrink-0 mt-0.5" />
            : <ShieldAlert className="w-5 h-5 text-rp-muted shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <h2 className="text-rp-text font-medium">
              Two-factor sign-in {status?.enabled ? 'is on' : 'is off'}
            </h2>
            <p className="text-rp-muted text-sm mt-1">
              {status?.enabled
                ? `A code from your authenticator app is required at every sign-in. ${status.recoveryCodesRemaining} recovery code(s) left.`
                : 'A password on its own is enough to sign in to this account right now.'}
            </p>
          </div>
        </div>

        {/* Off, and not yet enrolling */}
        {!status?.enabled && !secret && (
          <button
            type="button"
            onClick={startSetup}
            disabled={busy}
            className="mt-4 px-4 py-2 rounded-lg text-sm bg-rp-brand text-white disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Turn on two-factor'}
          </button>
        )}

        {/* Enrolling */}
        {secret && (
          <div className="mt-5 space-y-4 border-t border-rp-border pt-5">
            <div>
              <p className="text-rp-text text-sm font-medium mb-1">
                1. Add this key to your authenticator app
              </p>
              <p className="text-rp-muted text-xs mb-2">
                Choose &ldquo;enter a setup key&rdquo; in the app and type it in. On the
                phone itself, the link below opens the app directly.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-rp-surface-3 border border-rp-border rounded-lg px-3 py-2 text-sm font-mono text-rp-text break-all">
                  {inGroups(secret)}
                </code>
                <button
                  type="button"
                  aria-label="Copy setup key"
                  onClick={() => { navigator.clipboard?.writeText(secret); setCopied(true); }}
                  className="p-2 rounded-lg text-rp-muted hover:text-rp-text hover:bg-rp-surface-3"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <a href={otpauth} className="text-rp-brand text-xs mt-2 inline-block break-all">
                Open in an authenticator app
              </a>
            </div>

            <div>
              <p className="text-rp-text text-sm font-medium mb-1">
                2. Type the code the app shows
              </p>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  className="w-32 h-10 rounded-lg border border-rp-border bg-rp-surface-3 px-3 text-rp-text text-sm tracking-widest"
                />
                <button
                  type="button"
                  onClick={enable}
                  disabled={busy || code.trim().length < 6}
                  className="px-4 h-10 rounded-lg text-sm bg-rp-brand text-white disabled:opacity-50"
                >
                  {busy ? 'Checking…' : 'Confirm'}
                </button>
              </div>
              <p className="text-rp-muted text-xs mt-2">
                Nothing changes until this code is accepted — you cannot lock
                yourself out by stopping here.
              </p>
            </div>
          </div>
        )}

        {/* On */}
        {status?.enabled && (
          <details className="mt-5 border-t border-rp-border pt-5">
            <summary className="text-rp-muted text-sm cursor-pointer">Turn two-factor off</summary>
            <div className="mt-3 space-y-2">
              <p className="text-rp-muted text-xs">
                Your password and a current code, because a stolen session should
                not be able to do this.
              </p>
              <input
                type="password"
                value={offPassword}
                onChange={(e) => setOffPassword(e.target.value)}
                placeholder="Password"
                className="w-full h-10 rounded-lg border border-rp-border bg-rp-surface-3 px-3 text-rp-text text-sm"
              />
              <input
                value={offCode}
                onChange={(e) => setOffCode(e.target.value)}
                placeholder="Authenticator or recovery code"
                className="w-full h-10 rounded-lg border border-rp-border bg-rp-surface-3 px-3 text-rp-text text-sm"
              />
              <button
                type="button"
                onClick={disable}
                disabled={busy || !offPassword || !offCode}
                className="px-4 py-2 rounded-lg text-sm text-rp-danger border border-rp-border hover:bg-rp-red-bg disabled:opacity-50"
              >
                Turn it off
              </button>
            </div>
          </details>
        )}
      </section>

      {/* ── Sessions ───────────────────────────────────────────────────── */}
      <section className="bg-rp-surface border border-rp-border rounded-rp-card p-5">
        <div className="flex items-start gap-3 mb-4">
          <Monitor className="w-5 h-5 text-rp-muted shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-rp-text font-medium">Where you are signed in</h2>
            <p className="text-rp-muted text-sm mt-1">
              Signing out here ends the session on the server, so a token copied
              elsewhere stops working too.
            </p>
          </div>
        </div>

        <ul className="divide-y divide-rp-border">
          {sessions.map((s) => (
            <li key={s.id} className="py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-rp-text text-sm">
                  {s.ipAddress || 'unknown address'}
                  {s.current && <span className="text-rp-brand text-xs ml-2">this one</span>}
                </p>
                <p className="text-rp-muted text-xs truncate">
                  Last used {when(s.lastSeenAt)} · signed in {when(s.createdAt)}
                </p>
                {s.userAgent && (
                  <p className="text-rp-faint text-xs truncate">{s.userAgent}</p>
                )}
              </div>
              {!s.current && (
                <button
                  type="button"
                  onClick={() => run(async () => {
                    await adminEndpoints.revokeSession(s.id);
                    await load();
                  })}
                  disabled={busy}
                  className="text-xs text-rp-muted hover:text-rp-danger disabled:opacity-50"
                >
                  Sign out
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={revokeOthers}
            disabled={busy || sessions.length < 2}
            className="px-3 py-2 rounded-lg text-sm border border-rp-border text-rp-text disabled:opacity-50"
          >
            Sign out everywhere else
          </button>
          <button
            type="button"
            onClick={signOutEverywhere}
            disabled={busy}
            className="px-3 py-2 rounded-lg text-sm text-rp-danger border border-rp-border hover:bg-rp-red-bg disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out everywhere, including here
          </button>
        </div>
      </section>
    </div>
  );
}
