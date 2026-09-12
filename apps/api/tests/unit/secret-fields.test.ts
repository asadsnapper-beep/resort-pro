import { describe, it, expect } from 'vitest';
import { secretFieldsOf, tenantSecretFields } from '../helpers/secret-fields';

/**
 * The detector that decides which columns a response may never carry.
 *
 * It reads schema.prisma instead of holding a list, because a list of secrets
 * goes stale precisely when it matters — the month someone adds a new one. So
 * the detector itself has to be trustworthy, which is what these cases are for.
 */
describe('finding the secret-looking columns of a model', () => {
  const fixture = `
model Tenant {
  id                String  @id @default(uuid())
  name              String
  smsApiKey         String?
  smsApiSecret      String?
  waApiToken        String?
  waPhoneNumberId   String?
  ssoClientSecret   String? // stored encrypted in production
  stripeCustomerId  String?
  createdAt         DateTime @default(now())

  rooms Room[]

  @@index([slug])
}

model Room {
  id        String  @id
  secretKey String?
}
`;

  it('catches the four shapes a credential name takes here', () => {
    const found = secretFieldsOf(fixture, 'Tenant');
    expect(found).toEqual(['smsApiKey', 'smsApiSecret', 'waApiToken', 'ssoClientSecret']);
  });

  it('leaves identifiers alone', () => {
    const found = secretFieldsOf(fixture, 'Tenant');
    // An id is not a credential. Treating it as one would make the guard noisy
    // and then ignored.
    expect(found).not.toContain('waPhoneNumberId');
    expect(found).not.toContain('stripeCustomerId');
  });

  it('stops at the end of the model it was asked about', () => {
    // Room.secretKey belongs to another model; bleeding past the closing brace
    // would make the guard assert on fields the route never returns.
    expect(secretFieldsOf(fixture, 'Tenant')).not.toContain('secretKey');
    expect(secretFieldsOf(fixture, 'Room')).toEqual(['secretKey']);
  });

  it('says so loudly when the model is gone', () => {
    // A silent empty list would turn the response guard into a no-op the day
    // the schema is restructured.
    expect(() => secretFieldsOf(fixture, 'Nonexistent')).toThrow(/not found/);
  });
});

describe('the real schema', () => {
  it('has secrets on Tenant for the response guard to protect', () => {
    const found = tenantSecretFields();

    // If this ever comes back empty the guard is vacuous, and a passing
    // response test would mean nothing.
    expect(found.length).toBeGreaterThan(0);
    expect(found).toContain('waApiToken');
    expect(found).toContain('ssoClientSecret');
  });
});
