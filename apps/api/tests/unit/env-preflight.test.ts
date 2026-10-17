/**
 * What production is allowed to start with.
 *
 * `docker compose config` exits 0 with every required value unset — it only
 * warns — so a production stack could come up pointing entirely at localhost
 * and look healthy from outside (RC-M05). The only boot check was JWT_SECRET,
 * and only for being absent.
 *
 * The cases that matter here are the ones that are *set* and still wrong: a
 * localhost database URL, the dev default secret, a placeholder nobody came
 * back to. Those pass every "is it defined?" check ever written, which is
 * exactly how they reach production.
 *
 * And the other direction, which has its own test: refusing to boot over a
 * missing SMS key would turn a degraded feature into an outage, so only the
 * handful of things the API genuinely cannot serve without are fatal.
 */
import { describe, it, expect, vi } from 'vitest';
import { inspectEnv, preflightEnv } from '../../src/utils/env-preflight';

/** A production environment with nothing wrong with it. */
const good = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://resortpro:s3cret@db.internal:5432/resortpro',
  JWT_SECRET: 'PGMy7Qa2kZr4XvLs9TdBw1NfHc6Ue0Ij',
  CREDENTIALS_KEY: 'bEHiKm4Qs8Uw2Yz6Ac0Eg4Ik8Mo2Qs6Uw0=',
  APP_URL: 'https://api.resortpro.site',
  WEB_URL: 'https://resortpro.site',
  CORS_ORIGIN: 'https://resortpro.site',
  RESEND_API_KEY: 're_live_abcdefghijklmnop',
  SUPER_ADMIN_PASSWORD: 'rN7vQa2kZr4XvLs9',
});

const problemFor = (env: NodeJS.ProcessEnv, variable: string) =>
  inspectEnv(env).find((p) => p.variable === variable);

describe('a production environment that is actually configured', () => {
  it('has nothing to say about it', () => {
    expect(inspectEnv(good())).toEqual([]);
  });
});

describe('set, but not to anything production', () => {
  it.each([
    ['DATABASE_URL', 'postgresql://resortpro:resortpro@localhost:5432/resortpro'],
    ['APP_URL', 'http://localhost:4000'],
    ['WEB_URL', 'http://127.0.0.1:3000'],
    ['CORS_ORIGIN', 'http://localhost:3000'],
  ])('catches %s pointing at this machine', (variable, value) => {
    const problem = problemFor({ ...good(), [variable]: value }, variable);
    expect(problem?.problem).toContain('localhost');
  });

  it('catches the dev default JWT secret, which is in the repository', () => {
    const problem = problemFor(
      { ...good(), JWT_SECRET: 'dev-secret-change-in-production' },
      'JWT_SECRET',
    );
    expect(problem?.severity).toBe('fatal');
    expect(problem?.problem).toContain('placeholder');
  });

  it.each(['change-me', 'your-secret-here', 'TODO', 'placeholder-value-123456'])(
    'catches the placeholder %o',
    (value) => {
      expect(problemFor({ ...good(), JWT_SECRET: value }, 'JWT_SECRET')).toBeTruthy();
    },
  );

  it('catches the value copied straight out of .env.example', () => {
    const value = 'your-super-secret-jwt-key-change-in-production';
    expect(problemFor({ ...good(), JWT_SECRET: value }, 'JWT_SECRET')?.severity).toBe('fatal');
  });

  it.each([
    ['openssl output', 'ZmFrZUJhc2U2NFNlY3JldFZhbHVlMTIzNDU2Nzg5MA=='],
    ['a human passphrase', 'ResortProSecretKey2026!Strong'],
    ['one with password in it', 'MyLongPasswordPhrase-2026-xyz'],
  ])('leaves a real secret alone: %s', (_label, value) => {
    // The first version of the placeholder list had bare `secret` and
    // `password` in it, so both of these were fatal — a check that rejects a
    // good secret is how a preflight ends up switched off.
    expect(problemFor({ ...good(), JWT_SECRET: value }, 'JWT_SECRET')).toBeUndefined();
  });

  it('lets production as it stands today start, with warnings', () => {
    // Database and JWT are set; the two the founder has yet to add are not.
    const env = { ...good() };
    delete env.CREDENTIALS_KEY;
    delete env.SUPER_ADMIN_PASSWORD;

    const problems = inspectEnv(env);
    expect(problems.filter((p) => p.severity === 'fatal')).toEqual([]);
    expect(problems.map((p) => p.variable).sort())
      .toEqual(['CREDENTIALS_KEY', 'SUPER_ADMIN_PASSWORD']);
  });

  it('catches a secret that is simply too short to be one', () => {
    const problem = problemFor({ ...good(), JWT_SECRET: 'Rk4Qs8Uw2' }, 'JWT_SECRET');
    expect(problem?.problem).toContain('characters');
  });
});

describe('what counts as fatal', () => {
  it('stops for the two the API cannot serve without', () => {
    const env = { ...good() };
    delete env.DATABASE_URL;
    delete env.JWT_SECRET;

    const fatal = inspectEnv(env).filter((p) => p.severity === 'fatal').map((p) => p.variable);
    expect(fatal.sort()).toEqual(['DATABASE_URL', 'JWT_SECRET']);
  });

  it('does not demand JWT_REFRESH_SECRET, which nothing reads', () => {
    // It is in no compose file and in no source file. Requiring it would have
    // stopped production booting over a variable that does not exist.
    const env = { ...good() };
    delete env.JWT_REFRESH_SECRET;
    expect(problemFor(env, 'JWT_REFRESH_SECRET')).toBeUndefined();
  });

  it('does not stop for a missing credentials key — reads still work, writes are refused', () => {
    const env = { ...good() };
    delete env.CREDENTIALS_KEY;
    expect(problemFor(env, 'CREDENTIALS_KEY')?.severity).toBe('warn');
  });

  it.each(['RESEND_API_KEY', 'SUPER_ADMIN_PASSWORD', 'APP_URL', 'WEB_URL', 'CORS_ORIGIN'])(
    'does not stop for a missing %s',
    (variable) => {
      const env = { ...good() };
      delete env[variable];
      expect(problemFor(env, variable)?.severity).toBe('warn');
    },
  );

  it('puts the fatal ones first, so the first line read is the one that matters', () => {
    const env = { ...good() };
    delete env.DATABASE_URL;
    delete env.RESEND_API_KEY;
    expect(inspectEnv(env)[0].variable).toBe('DATABASE_URL');
  });
});

describe('outside production', () => {
  it.each(['development', 'test', undefined])('says nothing when NODE_ENV is %o', (nodeEnv) => {
    const exit = vi.fn() as unknown as (code: number) => never;
    const env = nodeEnv ? { NODE_ENV: nodeEnv } : {};

    expect(preflightEnv(env, exit)).toEqual([]);
    expect(exit).not.toHaveBeenCalled();
  });
});

describe('preflightEnv', () => {
  it('exits when something fatal is wrong', () => {
    const exit = vi.fn() as unknown as (code: number) => never;
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const env = { ...good() };
    delete env.DATABASE_URL;

    try {
      preflightEnv(env, exit);
      expect(exit).toHaveBeenCalledWith(1);
      expect(quiet.mock.calls.flat().join(' ')).toContain('DATABASE_URL');
    } finally {
      quiet.mockRestore();
    }
  });

  it('reports and carries on when nothing is fatal', () => {
    const exit = vi.fn() as unknown as (code: number) => never;
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const env = { ...good() };
    delete env.RESEND_API_KEY;

    try {
      const problems = preflightEnv(env, exit);
      expect(problems.map((p) => p.variable)).toEqual(['RESEND_API_KEY']);
      expect(exit).not.toHaveBeenCalled();
    } finally {
      quiet.mockRestore();
    }
  });

  it('never prints the value of anything it complains about', () => {
    const exit = vi.fn() as unknown as (code: number) => never;
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const secret = 'change-me-but-nobody-did-0123456789';

    try {
      preflightEnv({ ...good(), JWT_SECRET: secret }, exit);
      expect(quiet.mock.calls.flat().join(' ')).not.toContain(secret);
    } finally {
      quiet.mockRestore();
    }
  });
});
