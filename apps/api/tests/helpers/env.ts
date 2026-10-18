import { beforeAll, afterAll } from 'vitest';

/**
 * Keep an environment variable inside the file that changes it.
 *
 * Every test file in this suite shares one process — vitest.config.ts runs a
 * single fork, because the tests share a real database. So an env var set by
 * one file is still set for every file that runs after it, and the failure it
 * causes appears somewhere else entirely.
 *
 * That is not hypothetical. `messaging.test.ts` set META_WA_TOKEN to prove a
 * tenant with its own broken credentials does not fall back to the platform
 * account, and never unset it — so `no-false-success.test.ts`, which asserts
 * what happens when no platform account is configured, found one configured and
 * failed. It passed on its own and failed in the suite, which is the most
 * expensive kind of red there is.
 *
 * This restores exactly what was there, including having been unset, so a file
 * leaks neither a value nor its absence.
 */
export function keepEnv(...keys: string[]) {
  let saved: Record<string, string | undefined> = {};

  beforeAll(() => {
    saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  });

  afterAll(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });
}
