'use client';

/**
 * Asks for the password when the API says an action needs it confirmed.
 *
 * Without this the guard would only break things: the API answers 403
 * REAUTH_REQUIRED on deleting a resort, changing the admin team or writing
 * platform credentials, and the panel would show "that did not work" with no
 * way to get past it.
 *
 * It is mounted once in the admin layout and driven by the axios interceptor in
 * admin-api.ts, which pauses the failed request, waits for this, and then sends
 * it again. So every screen gets it without knowing it exists — including the
 * ones written before this did.
 */

import { useEffect, useState } from 'react';
import { adminApi, onReauthNeeded } from '@/lib/admin-api';
import { Lock, Loader2 } from 'lucide-react';

export default function ReauthPrompt() {
  const [ask, setAsk] = useState<null | { resolve: (ok: boolean) => void }>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => onReauthNeeded((resolve) => {
    setPassword('');
    setCode('');
    setNeedsCode(false);
    setError('');
    setAsk({ resolve });
  }), []);

  if (!ask) return null;

  const close = (confirmed: boolean) => {
    ask.resolve(confirmed);
    setAsk(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await adminApi.post('/reauth', needsCode ? { password, code } : { password });
      close(true);
    } catch (err: any) {
      const body = err?.response?.data;
      // Two-factor is on: the same prompt grows a second field rather than
      // sending the person somewhere else mid-action.
      if (body?.code === 'MFA_INVALID' && !needsCode) {
        setNeedsCode(true);
        setError('This account has two-factor on — add the code.');
      } else {
        setError(body?.error || 'That did not work.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-rp-text/50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-rp-surface border border-rp-border rounded-rp-card p-5"
      >
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-rp-brand" />
          <h2 className="text-rp-text font-medium">Confirm it is you</h2>
        </div>
        <p className="text-rp-muted text-sm mb-4">
          This action cannot be undone, so it needs your password even though you
          are already signed in.
        </p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          autoComplete="current-password"
          className="w-full h-10 rounded-lg border border-rp-border bg-rp-surface-3 px-3 text-rp-text text-sm mb-2"
        />
        {needsCode && (
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Authenticator or recovery code"
            autoComplete="one-time-code"
            className="w-full h-10 rounded-lg border border-rp-border bg-rp-surface-3 px-3 text-rp-text text-sm mb-2"
          />
        )}

        {error && <p className="text-rp-danger text-sm mb-2">{error}</p>}

        <div className="flex justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={() => close(false)}
            className="px-3 py-2 rounded-lg text-sm text-rp-muted hover:text-rp-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !password}
            className="px-4 py-2 rounded-lg text-sm bg-rp-brand text-white disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirm
          </button>
        </div>
      </form>
    </div>
  );
}
