/**
 * Create the platform's SUPER_ADMIN accounts from `SUPER_ADMIN_EMAILS`.
 *
 * The API image runs this on every container start, which is the whole reason
 * the password handling here matters. It used to fall back to a hard-coded
 * `Admin@123456` when `SUPER_ADMIN_PASSWORD` was absent — and no compose file
 * passes that variable — so any deployment against an empty database came up
 * with a real super-admin account whose password is printed in this repository
 * (release-readiness review C-01).
 *
 * Now there is no fallback. Without a usable password the account is simply not
 * created, and the script says so loudly.
 *
 * It still exits 0 in that case. The startup command chains this with
 * `migrate deploy` and `node dist/index.js` using `&&`, so exiting non-zero
 * would turn one missing environment variable into the whole API not starting.
 * Refusing to create a weak account and refusing to serve traffic are different
 * things, and only the first one is wanted here.
 */
import bcrypt from 'bcryptjs';
import { prisma } from '@resort-pro/database';

/** Long enough that a leaked hash is not worth a dictionary run. */
const MIN_PASSWORD_LENGTH = 12;

/** The old fallback. Rejected by name in case it gets pasted into the env var. */
const RETIRED_DEFAULT = 'Admin@123456';

export type SeedPassword =
  | { ok: true; password: string }
  | { ok: false; reason: string };

export function resolveSeedPassword(env: NodeJS.ProcessEnv = process.env): SeedPassword {
  const password = env.SUPER_ADMIN_PASSWORD;

  if (!password) {
    return { ok: false, reason: 'SUPER_ADMIN_PASSWORD is not set' };
  }
  if (password === RETIRED_DEFAULT) {
    return {
      ok: false,
      reason: 'SUPER_ADMIN_PASSWORD is the old built-in default, which is public',
    };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      reason: `SUPER_ADMIN_PASSWORD is shorter than ${MIN_PASSWORD_LENGTH} characters`,
    };
  }
  return { ok: true, password };
}

export function parseAdminEmails(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * @returns the emails it created, so a caller can tell "nothing to do" from
 *          "refused to do it".
 */
export async function seedAdmins(env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  const emails = parseAdminEmails(env);

  if (emails.length === 0) {
    console.log('⚠️  No SUPER_ADMIN_EMAILS set in env. Nothing to seed.');
    return [];
  }

  const existing = await prisma.adminUser.findMany({
    where: { email: { in: emails } },
    select: { email: true, role: true },
  });
  const known = new Map(existing.map((a) => [a.email, a.role]));
  for (const [email, role] of known) {
    console.log(`⏭  Already exists: ${email} (role: ${role})`);
  }

  const missing = emails.filter((email) => !known.has(email));
  // Asking for a password when every account already exists would mean an
  // established deployment logging a scary refusal on every restart.
  if (missing.length === 0) return [];

  const resolved = resolveSeedPassword(env);
  if (!resolved.ok) {
    console.error(
      `\n🚫  Not creating ${missing.length} super-admin account(s): ${resolved.reason}.\n`
      + `    Waiting to be created: ${missing.join(', ')}\n`
      + '    Set SUPER_ADMIN_PASSWORD on this deployment and restart. Until then\n'
      + '    nobody can sign in to the admin panel — which is the intended\n'
      + '    outcome, and better than an account whose password is in the repo.\n'
      + '    Generate one with `openssl rand -base64 24`.\n',
    );
    return [];
  }

  const passwordHash = await bcrypt.hash(resolved.password, 12);
  const created: string[] = [];

  for (const email of missing) {
    await prisma.adminUser.create({
      data: { email, passwordHash, role: 'SUPER_ADMIN', firstName: 'Super', lastName: 'Admin' },
    });
    console.log(`✅  Created SUPER_ADMIN: ${email}`);
    created.push(email);
  }

  if (created.length > 0) {
    console.log('ℹ️  Change this password after the first sign-in.');
  }
  return created;
}

async function main() {
  await seedAdmins();
  await prisma.$disconnect();
}

// Only when run as the script, so tests can import the functions above. The
// `typeof` guards are for the test runner, which loads this as an ES module
// where neither `require` nor `module` exists.
const runningAsScript = typeof require !== 'undefined'
  && typeof module !== 'undefined'
  && require.main === module;

if (runningAsScript) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
