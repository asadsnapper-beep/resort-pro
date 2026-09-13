/**
 * Every nav label must exist in every locale.
 *
 * Five nav keys had no translation at all, so next-intl logged MISSING_MESSAGE
 * on every dashboard page load, for the English locale, forever. The links
 * still read correctly — NavItem carries a labelFallback — which is exactly why
 * nobody fixed it: the only symptom was console noise, and console noise is
 * where a real client error goes to hide. Both the 2026-09-08 and 2026-09-09
 * audits reported it, the second one twice.
 *
 * A sixth, nav.myShares, was missing too. The audits browsed as Owner and never
 * saw it, because My Shares belongs to the Shareholder role.
 *
 * So the count is not the point and neither is the list: the point is that
 * adding a nav item must not be able to ship without its text.
 */
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('@/lib/api', () => ({ authApi: {}, tenantApi: {}, dashboardApi: {}, api: { get: vi.fn() } }));

import { NAV_ITEMS } from './sidebar';

const MESSAGES = path.join(__dirname, '../../../messages');
const LOCALES = fs.readdirSync(MESSAGES).filter((d) =>
  fs.statSync(path.join(MESSAGES, d)).isDirectory());

const load = (locale: string, file: string) =>
  JSON.parse(fs.readFileSync(path.join(MESSAGES, locale, file), 'utf-8'));

/** 'nav.venues' → the string at nav.venues, or undefined. */
const lookup = (messages: Record<string, unknown>, key: string): unknown =>
  key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    messages);

const flatten = (node: unknown, prefix = ''): string[] =>
  node && typeof node === 'object'
    ? Object.entries(node as Record<string, unknown>)
        .flatMap(([k, v]) => flatten(v, `${prefix}${k}.`))
    : [prefix.slice(0, -1)];

describe('nav translations', () => {
  it('has more than one locale to compare, so this suite cannot pass vacuously', () => {
    expect(LOCALES.length).toBeGreaterThan(1);
    expect(NAV_ITEMS.length).toBeGreaterThan(20);
  });

  for (const locale of LOCALES) {
    it(`resolves every nav label and group in ${locale}`, () => {
      const common = load(locale, 'common.json');
      const keys = [
        ...NAV_ITEMS.map((i) => i.labelKey),
        ...NAV_ITEMS.map((i) => i.groupKey),
      ];
      const missing = Array.from(new Set(keys)).filter((k) => typeof lookup(common, k) !== 'string');
      expect(missing, `missing in ${locale}/common.json`).toEqual([]);
    });
  }
});

describe('locale parity', () => {
  // Adding an English string and forgetting the Bangla one is the same defect
  // one step earlier, and it fails silently in exactly the same way.
  const files = fs.readdirSync(path.join(MESSAGES, 'en')).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    for (const locale of LOCALES.filter((l) => l !== 'en')) {
      it(`${locale}/${file} declares the same keys as en`, () => {
        const en = new Set(flatten(load('en', file)));
        const other = new Set(flatten(load(locale, file)));
        expect(Array.from(en).filter((k) => !other.has(k)), `absent from ${locale}`).toEqual([]);
        expect(Array.from(other).filter((k) => !en.has(k)), `absent from en`).toEqual([]);
      });
    }
  }
});
