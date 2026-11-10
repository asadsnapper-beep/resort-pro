#!/usr/bin/env node
/**
 * Every Playwright spec is either run by CI or excluded on purpose.
 *
 * The E2E job names the specs it runs, one path at a time. That is a
 * deliberate choice — the suite is slower than the gate it guards and not
 * every file belongs in it — but it has a failure mode nothing else catches:
 * a new spec file is simply never executed, and a renamed one stops being
 * executed, in both cases silently and with a green build.
 *
 * This is not hypothetical. RM-009 and RM-010 each had to be added to that
 * list by hand, and the note in the workflow says so; `auth.spec.ts` and
 * `dashboard.spec.ts` sat outside it for months, sixteen passing test runs
 * that protected nothing. (Room Management QA 2026-10-28, RM-013.)
 *
 * So: the files on disk and the files in the workflow must be the same set.
 * A file that should not run says so in the workflow, next to the reason:
 *
 *     # e2e-not-in-ci: tests/e2e/slow-thing.spec.ts — needs a real payment
 *
 * which keeps an exclusion visible and argued rather than invisible and
 * accidental. Both directions are checked, because a rename otherwise drops
 * coverage while still looking listed.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const WORKFLOW = '.github/workflows/ci.yml';
const SPEC_DIR = 'apps/web/tests/e2e';

const workflow = readFileSync(WORKFLOW, 'utf8');

/** The spec paths the workflow actually hands to Playwright. */
const invocation = workflow
  .split('\n')
  .find(line => line.includes('playwright test') && line.includes('tests/e2e/'));

if (!invocation) {
  console.error(`✗ ${WORKFLOW} has no "playwright test tests/e2e/..." command.`);
  console.error('  If the E2E job has been restructured, update this script with it.');
  process.exit(1);
}

const listed = new Set(invocation.match(/tests\/e2e\/[\w.-]+\.spec\.ts/g) ?? []);

/** Exclusions, each of which has to carry its reason on the same line. */
const excluded = new Map();
for (const line of workflow.split('\n')) {
  const match = line.match(/#\s*e2e-not-in-ci:\s*(tests\/e2e\/[\w.-]+\.spec\.ts)\s*[—-]\s*(.+)$/);
  if (match) excluded.set(match[1], match[2].trim());
}

const onDisk = new Set(
  readdirSync(SPEC_DIR)
    .filter(name => name.endsWith('.spec.ts'))
    .map(name => `tests/e2e/${name}`),
);

const problems = [];

for (const spec of [...onDisk].sort()) {
  if (listed.has(spec) || excluded.has(spec)) continue;
  problems.push(
    `${spec} exists but CI never runs it.\n` +
    `      Add it to the "playwright test" command in ${WORKFLOW}, or, if it\n` +
    `      should not run there, say why:\n` +
    `        # e2e-not-in-ci: ${spec} — <reason>`,
  );
}

for (const spec of [...listed].sort()) {
  if (onDisk.has(spec)) continue;
  problems.push(
    `${spec} is named in ${WORKFLOW} but no such file exists.\n` +
    `      A renamed or deleted spec leaves the list pointing at nothing, and\n` +
    `      Playwright is given a path it cannot run.`,
  );
}

for (const [spec, reason] of [...excluded].sort()) {
  if (onDisk.has(spec)) continue;
  problems.push(
    `${spec} is excluded ("${reason}") but no such file exists.\n` +
    `      Drop the exclusion; it is now only noise.`,
  );
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} E2E spec${problems.length === 1 ? '' : 's'} out of step with CI:\n`);
  for (const problem of problems) console.error(`  • ${problem}\n`);
  process.exit(1);
}

const counts = `${onDisk.size} spec${onDisk.size === 1 ? '' : 's'}`;
const note = excluded.size > 0 ? `, ${excluded.size} excluded on purpose` : '';
console.log(`✓ Every E2E spec is accounted for (${counts}${note}).`);
for (const [spec, reason] of [...excluded].sort()) {
  console.log(`  — not in CI: ${spec} (${reason})`);
}
