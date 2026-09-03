import { describe, expect, it } from 'vitest';
import { housekeepingAssignmentScope } from '../../src/routes/housekeeping';

describe('housekeepingAssignmentScope', () => {
  it('scopes STAFF through the Staff.userId relation', () => {
    expect(housekeepingAssignmentScope({ role: 'STAFF', sub: 'user-123' })).toEqual({
      assignedTo: { is: { userId: 'user-123' } },
    });
  });

  it.each(['OWNER', 'MANAGER', 'RECEPTIONIST'] as const)(
    'does not narrow the authorized %s overview',
    (role) => {
      expect(housekeepingAssignmentScope({ role, sub: 'user-123' })).toEqual({});
    },
  );

  it('does not treat an unrelated role as STAFF scope', () => {
    expect(housekeepingAssignmentScope({ role: 'SHAREHOLDER', sub: 'user-123' })).toEqual({});
  });
});
