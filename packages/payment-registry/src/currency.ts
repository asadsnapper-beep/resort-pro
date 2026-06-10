export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  subunit: number;   // smallest unit multiplier e.g. 100 for paisa, 1 for JPY
  locale: string;    // for Intl.NumberFormat
}

export const COUNTRY_CURRENCY: Record<string, CurrencyInfo> = {
  // South Asia
  BD: { code: 'BDT', symbol: '৳',   name: 'Bangladeshi Taka',   subunit: 100, locale: 'bn-BD' },
  IN: { code: 'INR', symbol: '₹',   name: 'Indian Rupee',        subunit: 100, locale: 'en-IN' },
  LK: { code: 'LKR', symbol: 'Rs',  name: 'Sri Lankan Rupee',    subunit: 100, locale: 'si-LK' },
  NP: { code: 'NPR', symbol: 'Rs.', name: 'Nepalese Rupee',      subunit: 100, locale: 'ne-NP' },
  PK: { code: 'PKR', symbol: '₨',   name: 'Pakistani Rupee',     subunit: 100, locale: 'ur-PK' },
  // SE Asia
  TH: { code: 'THB', symbol: '฿',   name: 'Thai Baht',           subunit: 100, locale: 'th-TH' },
  ID: { code: 'IDR', symbol: 'Rp',  name: 'Indonesian Rupiah',   subunit: 100, locale: 'id-ID' },
  MY: { code: 'MYR', symbol: 'RM',  name: 'Malaysian Ringgit',   subunit: 100, locale: 'ms-MY' },
  PH: { code: 'PHP', symbol: '₱',   name: 'Philippine Peso',     subunit: 100, locale: 'fil-PH' },
  VN: { code: 'VND', symbol: '₫',   name: 'Vietnamese Dong',     subunit: 1,   locale: 'vi-VN' },
  SG: { code: 'SGD', symbol: 'S$',  name: 'Singapore Dollar',    subunit: 100, locale: 'en-SG' },
  // East Africa
  KE: { code: 'KES', symbol: 'Ksh', name: 'Kenyan Shilling',     subunit: 100, locale: 'sw-KE' },
  TZ: { code: 'TZS', symbol: 'Tsh', name: 'Tanzanian Shilling',  subunit: 100, locale: 'sw-TZ' },
  GH: { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi',      subunit: 100, locale: 'ak-GH' },
  NG: { code: 'NGN', symbol: '₦',   name: 'Nigerian Naira',      subunit: 100, locale: 'en-NG' },
  // Global
  US: { code: 'USD', symbol: '$',   name: 'US Dollar',           subunit: 100, locale: 'en-US' },
  GB: { code: 'GBP', symbol: '£',   name: 'British Pound',       subunit: 100, locale: 'en-GB' },
  EU: { code: 'EUR', symbol: '€',   name: 'Euro',                subunit: 100, locale: 'en-EU' },
  AU: { code: 'AUD', symbol: 'A$',  name: 'Australian Dollar',   subunit: 100, locale: 'en-AU' },
  JP: { code: 'JPY', symbol: '¥',   name: 'Japanese Yen',        subunit: 1,   locale: 'ja-JP' },
};

export const DEFAULT_CURRENCY: CurrencyInfo = {
  code: 'USD', symbol: '$', name: 'US Dollar', subunit: 100, locale: 'en-US',
};

export function getCurrency(countryCode: string): CurrencyInfo {
  return COUNTRY_CURRENCY[countryCode.toUpperCase()] ?? DEFAULT_CURRENCY;
}

/** Convert display amount → smallest unit (e.g. 100 BDT → 10000 paisa) */
export function toSmallestUnit(amount: number, countryCode: string): number {
  const currency = getCurrency(countryCode);
  return Math.round(amount * currency.subunit);
}

/** Convert smallest unit → display amount (e.g. 10000 → 100 BDT) */
export function fromSmallestUnit(amount: number, countryCode: string): number {
  const currency = getCurrency(countryCode);
  return amount / currency.subunit;
}

/** Format amount for display */
export function formatAmount(amount: number, countryCode: string): string {
  const currency = getCurrency(countryCode);
  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: currency.subunit === 1 ? 0 : 2,
  }).format(amount);
}
