'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) {
      document.addEventListener('keydown', handler);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(27,52,47,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-[18px] bg-white shadow-2xl overflow-hidden ${className ?? ''}`}
        style={{ boxShadow: '0 24px 64px rgba(27,52,47,0.28)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 shrink-0"
          style={{ background: 'var(--rp-btn-accent)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h2 className="font-display text-[17px] font-medium text-[#dfd9d0]">{title}</h2>
            {description && <p className="mt-0.5 text-[12.5px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{description}</p>}
          </div>
          <button onClick={onClose}
            className="ml-4 flex h-[28px] w-[28px] items-center justify-center rounded-full transition-colors hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.6)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
}

export function ConfirmModal({ open, onClose, onConfirm, title, description, confirmLabel = 'Delete', loading }: ConfirmModalProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  React.useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!mounted || !open) return null;

  const isDestructive = ['deactivate', 'delete', 'remove'].some(w => confirmLabel.toLowerCase().includes(w));

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(27,52,47,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-[18px] bg-white overflow-hidden"
        style={{ boxShadow: '0 24px 64px rgba(27,52,47,0.28)' }}
        onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4" style={{ background: 'var(--rp-btn-accent)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-display text-[17px] font-medium text-[#dfd9d0]">{title}</h2>
        </div>
        <div className="px-6 pt-5 pb-6">
          <p className="text-[13.5px]" style={{ color: 'var(--rp-text-accent)' }}>{description}</p>
          <div className="mt-5 flex gap-3 justify-end">
            <button onClick={onClose}
              className="rounded-[9px] border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
              style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
              Cancel
            </button>
            <button onClick={onConfirm} disabled={loading}
              className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
              style={isDestructive
                ? { background: 'var(--rp-red-bg)', border: '1px solid rgba(200,60,60,0.2)', color: '#c43c3c' }
                : { background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {loading ? 'Please wait…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
