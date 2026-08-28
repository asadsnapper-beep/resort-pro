'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { locales, localeNames, type Locale } from '@/i18n/config';

interface LanguageSwitcherProps {
  currentLocale: Locale;
  variant?: 'button' | 'dropdown';
  className?: string;
  theme?: 'dark' | 'light'; // 'dark' for login/dark pages, 'light' for sidebar
}

export function LanguageSwitcher({
  currentLocale,
  variant = 'button',
  className = '',
  theme = 'dark',
}: LanguageSwitcherProps) {
  const isLight = theme === 'light';
  const t = useTranslations('common');
  const router = useRouter();

  const switchLocale = useCallback(
    async (locale: Locale) => {
      // Cookie-এ save করো
      document.cookie = `locale=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      router.refresh();
    },
    [router]
  );

  if (variant === 'button') {
    // Simple toggle button — EN ↔ বাংলা
    const nextLocale = currentLocale === 'en' ? 'bn' : 'en';
    return (
      <button
        onClick={() => switchLocale(nextLocale)}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium
          text-white/70 hover:text-white hover:bg-white/10 transition-all ${className}`}
        title={`Switch to ${localeNames[nextLocale]}`}
      >
        <span className="text-base">{currentLocale === 'en' ? '🇧🇩' : '🇬🇧'}</span>
        <span>{t('language.switchTo')}</span>
      </button>
    );
  }

  // Dropdown variant
  //
  // Opened by click, not by CSS :hover. Hover-only meant this could not be
  // opened on a phone — where there is no hover — or by keyboard, so the
  // dashboard had a language switcher that a Bangladeshi resort's staff could
  // not actually reach on the device they use it on.
  return <LocaleDropdown
    currentLocale={currentLocale}
    isLight={isLight}
    className={className}
    onSelect={switchLocale}
  />;
}

function LocaleDropdown({
  currentLocale,
  isLight,
  className,
  onSelect,
}: {
  currentLocale: Locale;
  isLight: boolean;
  className: string;
  onSelect: (locale: Locale) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // Close on Escape and on a click outside. Without the outside-click the menu
  // would sit open behind whatever the user tapped next.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className={`flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all
        ${isLight
          ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800'
          : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}>
        <span className="text-base">{currentLocale === 'en' ? '🇬🇧' : '🇧🇩'}</span>
        <span>{localeNames[currentLocale]}</span>
        <svg className="ml-auto h-3.5 w-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        id={menuId}
        role="menu"
        hidden={!open}
        className={`absolute bottom-full left-0 mb-1 w-40 rounded-xl border shadow-xl transition-all z-50
        ${open ? 'opacity-100 visible' : 'pointer-events-none opacity-0 invisible'}
        ${isLight
          ? 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
          : 'border-white/10 bg-resort-900'
        }`}>
        {locales.map((loc) => (
          <button
            key={loc}
            type="button"
            role="menuitem"
            onClick={() => { onSelect(loc); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors
              first:rounded-t-xl last:rounded-b-xl
              ${currentLocale === loc
                ? isLight
                  ? 'bg-resort-50 text-resort-700 font-medium dark:bg-resort-900/20 dark:text-resort-400'
                  : 'bg-resort-500/20 text-resort-300 font-medium'
                : isLight
                  ? 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
          >
            <span>{loc === 'en' ? '🇬🇧' : '🇧🇩'}</span>
            <span>{localeNames[loc]}</span>
            {currentLocale === loc && (
              <svg className="ml-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
