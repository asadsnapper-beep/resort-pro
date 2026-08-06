'use client';

import { useState, type ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { ModalShell } from '@/components/ui/modal-shell';

/**
 * ConfirmDialog — the one popup for "are you sure?" moments.
 *
 * Replaces the browser's raw `confirm()` (unstyled, can't show a loading
 * state, can't be themed) with ModalShell so it matches the rest of the app.
 * `onConfirm` may be async — the dialog disables its buttons and shows a
 * spinner while it's pending, and surfaces a thrown error inline instead of
 * closing, so the caller doesn't need its own loading/error plumbing just for
 * the confirmation step.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'neutral',
  variant = 'admin',
}: {
  open: boolean;
  onClose: () => void;
  /** May return a promise — the dialog awaits it before closing. */
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' reddens the confirm button and adds a warning line — use for anything destructive or hard to undo. */
  tone?: 'danger' | 'neutral';
  /** Which ModalShell skin to render in. Admin pages want 'admin'; resort dashboard pages should pass 'resort'. */
  variant?: 'resort' | 'admin';
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={title}
      variant={variant}
      maxWidth="440px"
      showCloseButton={!loading}
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="h-9 border border-rp-border-md px-4 text-sm font-semibold text-rp-text hover:bg-rp-surface-3 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={
              tone === 'danger'
                ? 'inline-flex h-9 items-center gap-2 bg-rp-danger px-4 text-sm font-semibold text-rp-btn-accent-text hover:opacity-90 disabled:opacity-50'
                : 'inline-flex h-9 items-center gap-2 bg-rp-brand px-4 text-sm font-semibold text-rp-btn-accent-text hover:bg-rp-brand-hover disabled:opacity-50'
            }
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      }
    >
      {tone === 'danger' && (
        <div className="mb-3 flex items-center gap-2 text-rp-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-rp-meta font-bold uppercase tracking-wide">This can&apos;t be undone</span>
        </div>
      )}
      {description && <p className="text-rp-body text-rp-muted">{description}</p>}
      {error && <p className="mt-3 text-rp-meta font-semibold text-rp-danger">{error}</p>}
    </ModalShell>
  );
}
