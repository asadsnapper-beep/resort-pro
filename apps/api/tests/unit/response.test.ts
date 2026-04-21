import { describe, it, expect } from 'vitest';
import { ok, paginated, parsePageParams } from '../../src/utils/response';

describe('ok', () => {
  it('wraps data in success response', () => {
    const res = ok({ id: '1' });
    expect(res).toEqual({ success: true, data: { id: '1' } });
  });

  it('includes optional message', () => {
    const res = ok(null, 'Created');
    expect(res.message).toBe('Created');
  });
});

describe('paginated', () => {
  it('calculates totalPages correctly', () => {
    const res = paginated([1, 2, 3], 23, 1, 10);
    expect(res.pagination.totalPages).toBe(3);
    expect(res.pagination.total).toBe(23);
  });

  it('rounds up totalPages', () => {
    const res = paginated([], 21, 1, 10);
    expect(res.pagination.totalPages).toBe(3);
  });
});

describe('parsePageParams', () => {
  it('defaults to page 1 limit 20', () => {
    const { page, limit, skip } = parsePageParams({});
    expect(page).toBe(1);
    expect(limit).toBe(20);
    expect(skip).toBe(0);
  });

  it('caps limit at 100', () => {
    const { limit } = parsePageParams({ limit: 999 });
    expect(limit).toBe(100);
  });

  it('calculates skip correctly', () => {
    const { skip } = parsePageParams({ page: 3, limit: 10 });
    expect(skip).toBe(20);
  });
});
