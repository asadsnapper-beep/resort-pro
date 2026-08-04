'use client';

import { useEffect, useRef, useState } from 'react';
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
}: ModalShellProps) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

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

  if (!mounted || !open) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        background: 'rgba(24,49,83,0.5)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth,
          maxHeight: 'calc(100vh - 40px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '18px',
          background: isDark ? '#10243f' : '#ffffff',
          boxShadow: '0 32px 80px rgba(24,49,83,0.35)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          background: 'var(--rp-btn-accent)',
          borderBottom: '1px solid rgba(255,255,255,0.14)',
          padding: '16px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display, serif)', fontSize: '17px', fontWeight: 500, color: 'var(--rp-btn-accent-text)', margin: 0 }}>
              {title}
            </h2>
            {description && (
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', margin: '2px 0 0' }}>
                {description}
              </p>
            )}
          </div>
          {showCloseButton && (
            <button
              ref={closeRef}
              onClick={onClose}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '28px', width: '28px', borderRadius: '50%',
                border: 'none', background: 'transparent',
                color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <X style={{ width: '16px', height: '16px' }} />
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
            borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
            background: isDark ? 'rgba(255,255,255,0.04)' : 'var(--rp-surface-2)',
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
