import { describe, it, expect } from 'vitest';
import { matchAllTerms } from '../../src/utils/search-terms';

describe('matchAllTerms', () => {
  it('returns undefined for an empty query, so callers can spread it away', () => {
    expect(matchAllTerms('', ['name'])).toBeUndefined();
    expect(matchAllTerms('   ', ['name'])).toBeUndefined();
    expect(matchAllTerms(undefined, ['name'])).toBeUndefined();
  });

  it('one term behaves exactly as a single contains did', () => {
    const w = matchAllTerms('karim', ['firstName', 'email'])!;
    expect(w.AND).toHaveLength(1);
    expect(w.AND[0]!.OR).toEqual([
      { firstName: { contains: 'karim', mode: 'insensitive' } },
      { email:     { contains: 'karim', mode: 'insensitive' } },
    ]);
  });

  it('requires every term to match somewhere — this is the full-name fix', () => {
    const w = matchAllTerms('Karim Hossain', ['firstName', 'lastName'])!;
    expect(w.AND).toHaveLength(2);
    expect(w.AND[0]!.OR[0]).toEqual({ firstName: { contains: 'Karim', mode: 'insensitive' } });
    expect(w.AND[1]!.OR[1]).toEqual({ lastName: { contains: 'Hossain', mode: 'insensitive' } });
  });

  it('nests dotted paths for relations', () => {
    const w = matchAllTerms('karim', ['guest.firstName'])!;
    expect(w.AND[0]!.OR[0]).toEqual({ guest: { firstName: { contains: 'karim', mode: 'insensitive' } } });
  });

  it('nests more than one level', () => {
    const w = matchAllTerms('x', ['booking.guest.email'])!;
    expect(w.AND[0]!.OR[0]).toEqual({ booking: { guest: { email: { contains: 'x', mode: 'insensitive' } } } });
  });

  it('caps at five terms so a pasted paragraph cannot fan out the query', () => {
    expect(matchAllTerms('a b c d e f g h', ['name'])!.AND).toHaveLength(5);
  });

  it('collapses repeated whitespace rather than making empty terms', () => {
    expect(matchAllTerms('  Karim   Hossain ', ['firstName'])!.AND).toHaveLength(2);
  });
});
