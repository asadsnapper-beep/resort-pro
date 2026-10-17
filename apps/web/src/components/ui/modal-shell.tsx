'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  showCloseButton?: boolean;
  /** Admin modals use the scoped Modernist staff-console system. */
  variant?: 'resort' | 'admin';
}

/**
 * ModalShell — standard modal for all ResortPro modals.
 *
 * Style spec (matches RoomModal):
 *   Backdrop  : rgba(24,49,83,0.5) + blur(5px)
 *   Container : white (light) / #10243f (dark), border-radius 18px
 *   Header    : #183153, title #f8fafc, subtitle rgba(255,255,255,0.4)
 *   Body      : scrollable, padding 24px
 *   Footer    : var(--rp-surface-2) bg, top border rgba(255,255,255,0.08) dark / rgba(0,0,0,0.06) light
 */
export function ModalShell({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = '680px',
  showCloseButton = true,
  variant = 'resort',
}: ModalShellProps) {
  const [mounted, setMounted] = useState(false);
  // Stable per-instance ids so aria-labelledby/-describedby can name the real
  // header text rather than duplicating it into an aria-label that then drifts.
  const titleId = useId();
  const descriptionId = useId();
  const [isDark, setIsDark] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Escape closes. Clicking the backdrop already did; the keyboard had no way
  // out at all, which for a dialog covering the screen is a trap.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Focus moves into the dialog when it opens and back to whatever opened it
  // when it closes. Without the second half, dismissing a modal dropped focus
  // onto document.body and a keyboard user restarted from the top of the page.
  //
  // `mounted` is in the deps because the first render returns null: the panel
  // does not exist until the render after it flips.
  useEffect(() => {
    if (!open || !mounted) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Three consumers autoFocus a field inside the dialog. Taking focus away
    // from them would be a regression dressed as an improvement.
    if (panel && !panel.contains(document.activeElement)) panel.focus();
    return () => {
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [open, mounted]);

  if (!mounted || !open) return null;

  const isAdmin = variant === 'admin';

  return createPortal(
    <div
      className={isAdmin ? 'admin-shell' : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        background: isAdmin ? 'color-mix(in srgb, #201e1d 50%, transparent)' : 'rgba(24,49,83,0.5)',
        backdropFilter: isAdmin ? undefined : 'blur(5px)',
        WebkitBackdropFilter: isAdmin ? undefined : 'blur(5px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* The panel is the dialog, not the backdrop. Without this a screen
          reader announced nothing: it saw plain divs, so a modal that visually
          takes over the screen was invisible as a modal. Every ModalShell
          consumer gets this, not just the one that surfaced it. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        /* Focusable only programmatically, so opening the dialog can place
           focus on it without adding a stop to the page's tab order. */
        tabIndex={-1}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth,
          maxHeight: 'calc(100vh - 40px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: isAdmin ? 0 : '18px',
          background: isAdmin ? 'var(--rp-surface)' : isDark ? '#10243f' : '#ffffff',
          border: isAdmin ? '2px solid var(--rp-border-md)' : undefined,
          boxShadow: isAdmin ? '0 12px 32px color-mix(in srgb, #2d2b2b 22%, transparent)' : '0 32px 80px rgba(24,49,83,0.35)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          background: isAdmin ? 'transparent' : 'var(--rp-btn-accent)',
          borderBottom: isAdmin ? '2px solid var(--rp-border)' : '1px solid rgba(255,255,255,0.14)',
          padding: '16px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h2 id={titleId} style={{ fontFamily: isAdmin ? 'Archivo, system-ui, sans-serif' : 'var(--font-display, serif)', fontSize: isAdmin ? '20px' : '17px', fontWeight: isAdmin ? 800 : 500, color: isAdmin ? 'var(--rp-text)' : 'var(--rp-btn-accent-text)', margin: 0 }}>
              {title}
            </h2>
            {description && (
              <p id={descriptionId} style={{ fontSize: '12px', color: isAdmin ? 'var(--rp-text-muted)' : 'rgba(255,255,255,0.4)', marginTop: '2px', margin: '2px 0 0' }}>
                {description}
              </p>
            )}
          </div>
          {showCloseButton && (
            <button
              onClick={onClose}
              type="button"
              /* An icon-only control with no text reads as just "button" to a
                 screen reader. Every ModalShell in the app had one. */
              aria-label="Close"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '28px', width: '28px', borderRadius: isAdmin ? 0 : '50%',
                border: 'none', background: 'transparent',
                color: isAdmin ? 'var(--rp-text-muted)' : 'rgba(255,255,255,0.6)', cursor: 'pointer',
                flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = isAdmin ? 'var(--rp-teal-bg)' : 'rgba(255,255,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <X aria-hidden="true" style={{ width: '16px', height: '16px' }} />
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '24px' }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            flexShrink: 0,
            padding: '14px 24px',
            borderTop: isAdmin ? '2px solid var(--rp-border)' : isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
            background: isAdmin ? 'transparent' : isDark ? 'rgba(255,255,255,0.04)' : 'var(--rp-surface-2)',
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
