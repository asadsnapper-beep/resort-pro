import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, type Locale, locales } from './config';

export default getRequestConfig(async () => {
  // 1. Cookie থেকে locale পড়ো (user manually set করলে)
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('locale')?.value as Locale | undefined;

  // 2. Valid locale হলে সেটা ব্যবহার করো
  let locale: Locale = defaultLocale;
  if (cookieLocale && locales.includes(cookieLocale)) {
    locale = cookieLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}/index.ts`)).default,
  };
});
