/**
 * What production needs before it is allowed to serve.
 *
 * `docker compose config` exits 0 with every one of these unset — it only
 * prints warnings — so a production stack can come up fully configured for
 * localhost and look healthy from the outside (RC-M05 of the 2026-09-30
 * release-candidate audit). Only one variable, JWT_SECRET, was ever checked at
 * boot, and only for being absent.
 *
 * Two kinds of wrong are caught here, and the second is the one that was
 * getting through:
 *
 *  - **missing** — nothing set at all;
 *  - **set to something that is not production** — a localhost URL, a
 *    placeholder, the dev default secret. These pass every check that asks
 *    "is it defined?", which is why they survive to production.
 *
 * Severity is deliberate. `fatal` stops the process, and is reserved for things
 * the API genuinely cannot work without — being down is better than being
 * wrong. Everything else is `warn`: loud, named, and at the top of the log,
 * because refusing to start over a missing SMS key would turn a degraded
 * feature into an outage.
 *
 * Development and test are left alone. Running locally against localhost is
 * the point of running locally.
 */

export type Severity = 'fatal' | 'warn';

export interface EnvProblem {
  variable: string;
  severity: Severity;
  problem: string;
}

/**
 * Values people leave behind when they mean to come back to it.
 *
 * Narrow on purpose. The first version of this list had bare `secret` and
 * `password` in it, which matches a perfectly good passphrase — and a fatal
 * check that rejects a real secret is how a preflight gets switched off. These
 * are the literal defaults in this repository plus markers nobody types by
 * accident.
 */
const PLACEHOLDERS = [
  'change-me', 'changeme', 'placeholder', 'todo', 'xxxx',
  'dev-secret-change-in-production', 'cookie-secret', 'ci-build-secret',
  'super-secret-refresh-key', 'change-in-production',
];

/** `your-super-secret-…`, the shape every example file in here uses. */
const PLACEHOLDER_PREFIXES = ['your-', 'my-', 'example'];

const looksLocal = (value: string) =>
  /localhost|127\.0\.0\.1|::1|\.local\b|host\.docker\.internal/i.test(value);

const looksPlaceholder = (value: string) => {
  const lower = value.toLowerCase();
  return PLACEHOLDERS.some((p) => lower.includes(p))
    || PLACEHOLDER_PREFIXES.some((p) => lower.startsWith(p));
};

interface Rule {
  variable: string;
  severity: Severity;
  /** Why this matters, in the message the operator reads. */
  needed: string;
  /** A URL that must not point at the machine it is running on. */
  url?: boolean;
  /** A secret that must be long and not a placeholder. */
  secret?: boolean;
  minLength?: number;
}

const RULES: Rule[] = [
  {
    variable: 'DATABASE_URL',
    severity: 'fatal',
    needed: 'the API cannot serve a single request without a database',
    url: true,
  },
  {
    variable: 'JWT_SECRET',
    severity: 'fatal',
    needed: 'every session token is signed with it',
    secret: true,
    minLength: 24,
  },
  // JWT_REFRESH_SECRET is deliberately not here, and the reason is worth
  // keeping: it was on this list as fatal until a check showed nothing in
  // `apps/api/src` reads it. Refresh tokens are signed by the same `app.jwt`
  // instance as access tokens, so JWT_SECRET covers both. It is also absent
  // from the production compose — so requiring it would have stopped
  // production booting over a variable the code has never looked at. A
  // preflight that demands things nothing uses is worse than no preflight:
  // the first time it is wrong, everybody learns to bypass it.
  {
    variable: 'CREDENTIALS_KEY',
    severity: 'warn',
    needed: 'without it a resort cannot save payment, SMS or SSO credentials — '
      + 'the API runs and reads what is already stored, but every new secret is refused',
    secret: true,
    minLength: 32,
  },
  {
    variable: 'APP_URL',
    severity: 'warn',
    needed: 'payment callbacks and email links are built from it, so a localhost '
      + 'value sends a paying guest to their own machine',
    url: true,
  },
  {
    variable: 'WEB_URL',
    severity: 'warn',
    needed: 'the dashboard links in emails are built from it',
    url: true,
  },
  {
    variable: 'CORS_ORIGIN',
    severity: 'warn',
    needed: 'the browser cannot reach the API from the real site without it',
    url: true,
  },
  {
    variable: 'RESEND_API_KEY',
    severity: 'warn',
    needed: 'no email leaves the system without it — no receipts, no password resets',
  },
  {
    variable: 'SUPER_ADMIN_PASSWORD',
    severity: 'warn',
    needed: 'on a fresh database no admin account is created without it, and '
      + 'there is no way into the admin panel',
    secret: true,
    minLength: 12,
  },
];

/**
 * @returns everything wrong with this environment, worst first. Empty is good.
 */
export function inspectEnv(env: NodeJS.ProcessEnv = process.env): EnvProblem[] {
  const problems: EnvProblem[] = [];

  for (const rule of RULES) {
    const value = env[rule.variable]?.trim();

    if (!value) {
      problems.push({
        variable: rule.variable,
        severity: rule.severity,
        problem: `not set — ${rule.needed}`,
      });
      continue;
    }

    if (rule.url && looksLocal(value)) {
      problems.push({
        variable: rule.variable,
        severity: rule.severity,
        problem: 'points at localhost, which is this container and nothing else',
      });
    }

    if (rule.secret) {
      if (looksPlaceholder(value)) {
        problems.push({
          variable: rule.variable,
          severity: rule.severity,
          problem: 'looks like a placeholder rather than a real secret',
        });
      } else if (rule.minLength && value.length < rule.minLength) {
        problems.push({
          variable: rule.variable,
          severity: rule.severity,
          problem: `is ${value.length} characters; at least ${rule.minLength} is expected`,
        });
      }
    }
  }

  return [...problems].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'fatal' ? -1 : 1));
}

export function formatProblems(problems: EnvProblem[]): string {
  const lines = problems.map(
    (p) => `  ${p.severity === 'fatal' ? '✗' : '!'} ${p.variable} — ${p.problem}`,
  );
  return lines.join('\n');
}

/**
 * Run the check and act on it. Called once, at boot, before anything listens.
 *
 * Outside production this reports nothing: the whole point of a local
 * environment is that it points at localhost.
 */
export function preflightEnv(
  env: NodeJS.ProcessEnv = process.env,
  exit: (code: number) => never = process.exit,
): EnvProblem[] {
  if (env.NODE_ENV !== 'production') return [];

  const problems = inspectEnv(env);
  if (problems.length === 0) return [];

  const fatal = problems.filter((p) => p.severity === 'fatal');

  console.error(
    `\n── Environment check ${fatal.length ? 'failed' : 'found problems'} ───────────────\n`
    + `${formatProblems(problems)}\n`,
  );

  if (fatal.length > 0) {
    console.error(
      `Refusing to start: ${fatal.length} of these cannot be worked around.\n`
      + 'Set them on this deployment and start again.\n',
    );
    exit(1);
  }

  console.error(
    'Starting anyway — none of these stop the API serving, and refusing to boot\n'
    + 'over them would turn a degraded feature into an outage. They are real\n'
    + 'though, and whoever deployed this is the person who can fix them.\n',
  );

  return problems;
}
