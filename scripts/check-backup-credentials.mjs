#!/usr/bin/env node
/**
 * The backup sidecar must connect to the same database the application does.
 *
 * This check exists because that stopped being true twice in two days, in the
 * same file, two lines apart:
 *
 *   - PGPASSWORD read ${POSTGRES_PASSWORD} bare while postgres defaulted it to
 *     "resortpro_staging", so pg_dump connected with no password.
 *   - POSTGRES_DB defaulted to "resortpro" while the database was created as
 *     "resortpro_staging", so pg_dump asked for a database that did not exist.
 *
 * Both failed loudly, every night, into a log nobody reads. Staging went from
 * August to September with about fifty 0-byte dump files and no database
 * backup at all. A comment warning about exactly this hazard was already in
 * the file — written by the same hand that then missed the line below it. So
 * the check is mechanical.
 *
 * It compares the values as Compose resolves them **with no environment set**,
 * which is the real deployed case for staging: that stack's env does not
 * define these variables, so the defaults written here are what the containers
 * actually get. Production does set them, and matching defaults still has to
 * hold there, or the same drift is one unset variable away.
 *
 * No dependencies on purpose. `yaml` is not a declared dependency of this
 * repository — it is only present locally by transitive luck — and adding one
 * for a lint script means lockfile churn, which has broken this CI before.
 * The reader below handles exactly the shape these files are written in and
 * reports loudly when it cannot find what it expects, rather than passing.
 *
 *   node scripts/check-backup-credentials.mjs
 */

import { readFileSync } from 'node:fs';

const FILES = [
  'docker-compose.staging.yml',
  'docker-compose.production.yml',
  'docker-compose.coolify.yml',
];

/**
 * The `KEY: value` pairs under `services.<service>.environment`.
 *
 * Deliberately narrow: two-space indentation, the service at indent 2, its
 * `environment:` at indent 4 (with or without a trailing YAML anchor), and the
 * variables at indent 6. Returns null when that shape is not found, which the
 * caller treats as a failure — never as "nothing to check".
 */
function readServiceEnvironment(text, service) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line === `  ${service}:`);
  if (start === -1) return null;

  let envAt = -1;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(#.*)?$/.test(line)) continue;
    const indent = line.length - line.trimStart().length;
    if (indent <= 2) break; // left this service
    if (indent === 4 && /^\s{4}environment:(\s|$)/.test(line)) {
      envAt = i;
      break;
    }
  }
  if (envAt === -1) return null;

  const env = {};
  for (let i = envAt + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(#.*)?$/.test(line)) continue;
    const indent = line.length - line.trimStart().length;
    if (indent < 6) break; // left the environment block
    if (indent > 6) continue; // nested structure — not a plain variable
    const match = /^\s{6}([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

/** Resolve `${VAR}` and `${VAR:-default}` the way Compose does with no env set. */
function resolveWithNoEnv(value) {
  return String(value ?? '').replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g,
    (_match, _name, fallback) => fallback ?? '',
  );
}

/** The database name out of postgresql://user:pass@host:port/NAME?query */
function databaseFromUrl(url) {
  const afterHost = url.split('@').pop() ?? '';
  const path = afterHost.split('/').slice(1).join('/');
  return (path.split('?')[0] ?? '').trim();
}

let failures = 0;

for (const file of FILES) {
  const text = readFileSync(file, 'utf8');
  const postgres = readServiceEnvironment(text, 'postgres');
  const backup = readServiceEnvironment(text, 'backup');
  const api = readServiceEnvironment(text, 'api');

  if (!postgres || !backup) {
    console.error(
      `✗ ${file}: could not read the ${!postgres ? 'postgres' : 'backup'} service's environment. ` +
        'Either the service is gone or the file no longer has the shape this check reads.',
    );
    failures++;
    continue;
  }

  const r = resolveWithNoEnv;

  // `--show` prints what this reader believes, so it can be compared against
  // `docker compose -f <file> config` — the authoritative resolver — when the
  // verdict is ever in doubt.
  if (process.argv.includes('--show')) {
    console.log(
      `${file}\n  postgres: user=${JSON.stringify(r(postgres.POSTGRES_USER))} ` +
        `db=${JSON.stringify(r(postgres.POSTGRES_DB))} pass=${JSON.stringify(r(postgres.POSTGRES_PASSWORD))}\n` +
        `  backup:   user=${JSON.stringify(r(backup.POSTGRES_USER))} ` +
        `db=${JSON.stringify(r(backup.POSTGRES_DB))} pass=${JSON.stringify(r(backup.PGPASSWORD))}`,
    );
  }

  const checks = [
    ['user', r(postgres.POSTGRES_USER), r(backup.POSTGRES_USER)],
    ['database', r(postgres.POSTGRES_DB), r(backup.POSTGRES_DB)],
    ['password', r(postgres.POSTGRES_PASSWORD), r(backup.PGPASSWORD)],
  ];

  // The API's connection string is proven to work every time the API starts,
  // so it is the tie-breaker when postgres and backup disagree.
  const apiUrl = api?.DATABASE_URL;
  if (apiUrl) {
    const fromUrl = databaseFromUrl(r(apiUrl));
    if (fromUrl) {
      checks.push(['database (vs the API\'s DATABASE_URL)', fromUrl, r(backup.POSTGRES_DB)]);
    }
  }

  const wrong = checks.filter(([, expected, actual]) => expected !== actual);

  if (wrong.length === 0) {
    console.log(`✓ ${file}`);
    continue;
  }

  failures++;
  console.error(`✗ ${file}: the backup would not reach the application's database`);
  for (const [what, expected, actual] of wrong) {
    console.error(`    ${what}: app has ${JSON.stringify(expected)}, backup has ${JSON.stringify(actual)}`);
  }
}

if (failures > 0) {
  console.error(
    '\nMake the backup service resolve to the same values as postgres.\n' +
      'A backup that cannot connect fails every night into a log nobody reads.',
  );
  process.exit(1);
}

console.log('\nBackup credentials match the application in every compose file.');
