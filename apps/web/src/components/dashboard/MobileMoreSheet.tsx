'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { X, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { NAV_ITEMS, getVisibleItems, groupItems } from '@/components/dashboard/sidebar';

/**
 * Mobile "More" menu — a bottom sheet listing EVERY dashboard page the
 * current role can access, grouped like the desktop sidebar. Without this,
 * phones could only reach the 4 bottom-bar tabs.
 *
 * Uses createPortal + body-overflow lock per the modal conventions.
 */
export function MobileMoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('common');
  const { user, tenant, clearAuth } = useAuthStore();

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const role = (user?.role ?? 'STAFF') as Parameters<typeof getVisibleItems>[0];
  const groups = groupItems(getVisibleItems(role));

  const label = (labelKey: string, fallback: string) => {
    // t.has avoids next-intl's MISSING_MESSAGE console noise for keys
    // that only exist as English fallbacks.
    const has = (t as unknown as { has?: (k: string) => boolean }).has;
    if (typeof has === 'function' && !has.call(t, labelKey)) return fallback;
    const tr: string = t(labelKey);
    return tr.endsWith(labelKey) ? fallback : tr;
  };

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] md:hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Sheet */}
      <div className="absolute inset-x-0 bottom-0 flex max-h-[82vh] flex-col rounded-t-[20px] bg-[#f7f5f0] shadow-2xl dark:bg-gray-900">
        {/* Handle + header */}
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <div>
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-black/15 dark:bg-white/20" />
            <p className="text-[15px] font-bold text-[#18231f] dark:text-[#dfd9d0]">{tenant?.name ?? 'Menu'}</p>
            <p className="text-[11.5px] text-[#8aa29a]">{user?.firstName} {user?.lastName} · {user?.role?.toLowerCase()}</p>
          </div>
          <button onClick={onClose} aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-[#4a6e66] dark:bg-white/10 dark:text-[#94b8b0]">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Scrollable groups */}
        <div className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} className="mb-4">
              <p className="mb-1.5 px-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#8aa29a]">{group}</p>
              <div className="grid grid-cols-3 gap-2">
                {items.map(({ href, labelKey, labelFallback, icon: Icon }) => {
                  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
                  return (
                    <button key={href} onClick={() => go(href)}
                      className="flex flex-col items-center gap-1.5 rounded-[12px] border p-3 text-center transition-colors"
                      style={active
                        ? { background: 'var(--rp-teal-bg, #e7f2ef)', borderColor: 'rgba(35,118,106,0.3)' }
                        : { background: 'white', borderColor: 'rgba(0,0,0,0.06)' }}>
                      <Icon className="h-5 w-5" style={{ color: active ? '#23766a' : '#6b8880' }} />
                      <span className="text-[11px] font-medium leading-tight"
                        style={{ color: active ? '#23766a' : '#3f4a47' }}>
                        {label(labelKey, labelFallback)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Sign out */}
          <button
            onClick={() => { clearAuth(); router.push('/auth/login'); }}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-[12px] border border-red-200 bg-white py-3 text-[13px] font-semibold text-red-600">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
