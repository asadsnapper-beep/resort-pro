'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { locales, localeNames, type Locale } from '@/i18n/config';

interface LanguageSwitcherProps {
  currentLocale: Locale;
  variant?: 'button' | 'dropdown';
  className?: string;
}

export function LanguageSwitcher({
  currentLocale,
  variant = 'button',
  className = '',
}: LanguageSwitcherProps) {
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
  return (
    <div className={`relative group ${className}`}>
      <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium
        text-white/70 hover:text-white hover:bg-white/10 transition-all">
        <span className="text-base">{currentLocale === 'en' ? '🇬🇧' : '🇧🇩'}</span>
        <span>{localeNames[currentLocale]}</span>
        <svg className="h-3.5 w-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div className="absolute right-0 top-full mt-1 w-36 rounded-xl border border-white/10
        bg-resort-900 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible
        transition-all z-50">
        {locales.map((locale) => (
          <button
            key={locale}
            onClick={() => switchLocale(locale)}
            className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors
              first:rounded-t-xl last:rounded-b-xl
              ${currentLocale === locale
                ? 'bg-resort-500/20 text-resort-300 font-medium'
                : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
          >
            <span>{locale === 'en' ? '🇬🇧' : '🇧🇩'}</span>
            <span>{localeNames[locale]}</span>
            {currentLocale === locale && (
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
