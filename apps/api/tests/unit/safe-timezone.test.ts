/**
 * A resort's timezone is free text, so it has to be treated as untrusted.
 *
 * `Tenant.timezone` is a plain string column with no enum behind it. Handing an
 * unrecognised value straight to `Intl` throws, and the Front Desk now reads
 * its day from that column — so one bad row would answer 500 to the one screen
 * a receptionist cannot work without.
 */
import { describe, it, expect } from 'vitest';
import { safeTimezone, tenantToday } from '../../src/utils/tenant-day';

describe('the timezone a day is resolved in', () => {
  it('keeps a zone Intl understands', () => {
    expect(safeTimezone('America/New_York')).toBe('America/New_York');
    expect(safeTimezone('Asia/Dhaka')).toBe('Asia/Dhaka');
    expect(safeTimezone('UTC')).toBe('UTC');
  });

  it('falls back when the column holds something Intl refuses', () => {
    expect(safeTimezone('Not/AZone')).toBe('Asia/Dhaka');
    expect(safeTimezone('Dhaka')).toBe('Asia/Dhaka');
  });

  it('falls back on an empty or missing value', () => {
    expect(safeTimezone(null)).toBe('Asia/Dhaka');
    expect(safeTimezone(undefined)).toBe('Asia/Dhaka');
    expect(safeTimezone('')).toBe('Asia/Dhaka');
  });

  it('takes a caller-chosen fallback', () => {
    expect(safeTimezone('Not/AZone', 'UTC')).toBe('UTC');
  });

  it('returns something tenantToday can actually use', () => {
    expect(() => tenantToday(safeTimezone('Not/AZone'))).not.toThrow();
  });
});
