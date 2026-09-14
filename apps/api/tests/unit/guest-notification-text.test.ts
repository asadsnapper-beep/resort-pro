/**
 * The confirmation message a guest reads, and the number it is sent to.
 */
import { describe, it, expect } from 'vitest';
import { bookingConfirmedText, normalizePhone } from '../../src/services/guest-notifications';

describe('normalizePhone', () => {
  it('adds Bangladesh\'s country code to a number written the local way', () => {
    expect(normalizePhone('01712345678', 'BD')).toBe('+8801712345678');
    expect(normalizePhone('017-1234 5678', 'BD')).toBe('+8801712345678');
  });

  it('leaves a number that already has its country code', () => {
    expect(normalizePhone('+8801712345678', 'BD')).toBe('+8801712345678');
    expect(normalizePhone('8801712345678', 'BD')).toBe('+8801712345678');
    expect(normalizePhone('+44 7700 900123', 'GB')).toBe('+447700900123');
  });

  it('does not guess a country code for a resort outside Bangladesh', () => {
    // 01… is not a Bangladeshi mobile everywhere; the provider decides.
    expect(normalizePhone('01712345678', 'IN')).toBe('01712345678');
  });
});

describe('bookingConfirmedText', () => {
  const booking = {
    resortName: 'Palm Resort',
    confirmationNo: 'BK-7F3A',
    checkIn: new Date('2026-10-14T00:00:00Z'),
    checkOut: new Date('2026-10-16T00:00:00Z'),
  };

  it('says what was booked, when, and for how long', () => {
    expect(bookingConfirmedText('en', booking)).toBe('Palm Resort: booking BK-7F3A confirmed. Check-in 14 Oct, 2 nights.');
  });

  it('uses the singular for one night', () => {
    expect(bookingConfirmedText('en', { ...booking, checkOut: new Date('2026-10-15T00:00:00Z') })).toMatch(/1 night\.$/);
  });

  it('writes Bangla when the resort chose Bangla', () => {
    expect(bookingConfirmedText('bn', booking)).toBe('Palm Resort: বুকিং BK-7F3A নিশ্চিত। চেক-ইন 14/10/2026, 2 রাত।');
  });

  it('falls back to English for anything else', () => {
    expect(bookingConfirmedText(null, booking)).toMatch(/^Palm Resort: booking/);
  });

  it('reads the check-in date in UTC, so it does not slip to the day before', () => {
    // A date-only column arrives as midnight UTC; in any timezone west of UTC
    // a local reading would print 13 Oct.
    expect(bookingConfirmedText('en', booking)).toContain('14 Oct');
  });

  it('fits one Unicode SMS segment in Bangla for a typical booking', () => {
    // 70 characters per segment once any Bangla is present; each extra segment
    // is billed. A long resort name can exceed it, which is acceptable; the
    // template itself must not.
    const text = bookingConfirmedText('bn', { ...booking, resortName: 'Palm' });
    expect([...text].length).toBeLessThanOrEqual(70);
  });
});
