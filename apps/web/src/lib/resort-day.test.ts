/**
 * The day a resort is having, not the day its browser is having.
 *
 * The bug these lock down: at 21:40 UTC on 2026-10-31 the Front Desk header
 * said Sunday 1 November (the Dhaka browser's date) while the Walk-In modal
 * defaulted check-in to 2026-10-31 (the UTC date) — for a resort in
 * America/New_York, where it was still the afternoon of the 31st. Three
 * different answers, none of them the resort's.
 */
import { describe, it, expect } from 'vitest';
import { resortDateOf, resortDayAfter, formatResortDate } from './resort-day';

// 2026-10-31 21:40 UTC — the instant the disagreement was observed.
const observed = new Date('2026-10-31T21:40:00Z');

describe('the resort\'s own date', () => {
  it('is yesterday in New York while UTC has already turned', () => {
    expect(resortDateOf(observed, 'America/New_York')).toBe('2026-10-31');
  });

  it('is tomorrow in Dhaka, where the night shift is already working', () => {
    expect(resortDateOf(observed, 'Asia/Dhaka')).toBe('2026-11-01');
  });

  it('falls back to a date rather than throwing on a nonsense timezone', () => {
    expect(resortDateOf(observed, 'Not/AZone')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('falls back when a signed-in session has no timezone yet', () => {
    expect(resortDateOf(observed, null)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(resortDateOf(observed, '')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('the night after', () => {
  it('crosses a month end', () => {
    expect(resortDayAfter('2026-10-31')).toBe('2026-11-01');
  });

  it('crosses a year end', () => {
    expect(resortDayAfter('2026-12-31')).toBe('2027-01-01');
  });

  it('does not lose a day in a zone behind UTC', () => {
    // Pure date arithmetic, so the browser's zone cannot shift it.
    expect(resortDayAfter('2026-03-01')).toBe('2026-03-02');
  });
});

describe('writing the date out', () => {
  it('prints the date it was given, not the one before it', () => {
    const out = formatResortDate('2026-10-31');
    // Asserted by parts rather than as one string. 'en-BD' is not a CLDR
    // locale — Intl resolves it to plain 'en' — so the word order is whatever
    // the ICU built into the running Node says it is, and CI runs Node 20
    // while this was written on 25. The bug being pinned is an off-by-one
    // day, which no word order can hide.
    expect(out).toContain('Saturday');
    expect(out).toContain('October');
    expect(out).toContain('31');
    expect(out).toContain('2026');
    expect(out).not.toContain('30');
  });

  it('leaves something unparseable alone', () => {
    expect(formatResortDate('')).toBe('');
  });
});
