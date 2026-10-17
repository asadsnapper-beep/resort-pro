/**
 * Reading the property the dashboard's top bar has selected.
 */
import { describe, it, expect } from 'vitest';
import { propertyScope, selectedPropertyId } from '../../src/utils/property-scope';

const ID = '3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b';
const req = (value?: string | string[]) => ({ headers: value === undefined ? {} : { 'x-property-id': value } }) as never;

describe('selectedPropertyId', () => {
  it('reads a property id from the header', () => {
    expect(selectedPropertyId(req(ID))).toBe(ID);
  });

  it('treats no header as "all properties", which is what every page showed before', () => {
    expect(selectedPropertyId(req())).toBeNull();
    expect(propertyScope(req())).toEqual({});
  });

  it('ignores anything that is not an id rather than filtering by it', () => {
    // An empty or garbage value must not silently empty every list.
    for (const bad of ['', 'all', 'null', 'undefined', `${ID}'; DROP TABLE rooms;--`, '123']) {
      expect(selectedPropertyId(req(bad))).toBeNull();
    }
  });

  it('takes the first value when a header is repeated', () => {
    expect(selectedPropertyId(req([ID, 'other']))).toBe(ID);
  });

  it('shapes it for a room query', () => {
    expect(propertyScope(req(ID))).toEqual({ propertyId: ID });
  });
});
