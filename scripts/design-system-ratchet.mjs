#!/usr/bin/env node
/**
 * Design system ratchet.
 *
 * Counts design-system violations in the dashboard pages and fails if any
 * category grew since the committed baseline. Existing debt is allowed to
 * sit; it just can't get worse.
 *
 * Why a ratchet and not an eslint rule: eslint isn't installed in this repo
 * (see the note on the CI typecheck job), and warnings nobody reads don't stop
 * regressions. This blocks them, with zero new dependencies.
 *
 *   node scripts/design-system-ratchet.mjs           # check against baseline
 *   node scripts/design-system-ratchet.mjs --update  # re-record the baseline
 *
 * Lower a baseline number whenever you migrate something — that's the ratchet
 * tightening. Raising one needs a reason in the commit message.
 *
 * See apps/web/DESIGN_TOKENS.md and plan/design-system-migration.md.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES_DIR = join(ROOT, 'apps/web/src/app/(dashboard)/dashboard');
const BASELINE = join(ROOT, 'scripts/design-system-baseline.json');

/** Each rule counts matches across all dashboard page.tsx files. */
const RULES = [
  {
    id: 'hardcoded-hex',
    label: 'Hardcoded hex colours',
    hint: 'Use a token: text-rp-text, bg-rp-surface-3, text-rp-brand … (see DESIGN_TOKENS.md)',
    match: /#[0-9a-fA-F]{6}\b/g,
  },
  {
    id: 'inline-style',
    label: 'Inline style={{ … }}',
    hint: 'Prefer tailwind classes built from tokens, or a pattern component',
    match: /style=\{\{/g,
  },
  {
    id: 'handwritten-page-header',
    label: 'Hand-written page h1 headers',
    hint: 'Use <PageHeader> from @/components/patterns',
    match: /font-display text-\[26px\]/g,
  },
  {
    id: 'arbitrary-font-size',
    label: 'Arbitrary text-[Npx] sizes',
    hint: 'Use the type scale: text-rp-body, text-rp-meta, text-rp-label, text-rp-micro',
    match: /text-\[\d+(\.\d+)?px\]/g,
  },
  {
    id: 'arbitrary-radius',
    label: 'Arbitrary rounded-[Npx]',
    hint: 'Use the radius scale: rounded-rp-card, rounded-rp-btn, rounded-rp-ctrl …',
    match: /rounded-\[\d+px\]/g,
  },
  {
    id: 'inline-card-shadow',
    label: 'Inlined card shadow literal',
    hint: 'Use shadow-rp-card',
    match: /0 1px 6px rgba\(0,0,0,0\.04\)/g,
  },
];

function pageFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...pageFiles(full));
    else if (entry === 'page.tsx') out.push(full);
  }
  return out;
}

const files = pageFiles(PAGES_DIR);
const counts = {};
const perFile = {};

for (const rule of RULES) {
  counts[rule.id] = 0;
  perFile[rule.id] = [];
}

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  for (const rule of RULES) {
    const n = (src.match(rule.match) ?? []).length;
    if (n > 0) {
      counts[rule.id] += n;
      perFile[rule.id].push({ file: relative(ROOT, file), n });
    }
  }
}

const updating = process.argv.includes('--update');

if (updating || !existsSync(BASELINE)) {
  writeFileSync(
    BASELINE,
    JSON.stringify({ note: 'Written by scripts/design-system-ratchet.mjs. Numbers may only go DOWN.', pages: files.length, counts }, null, 2) + '\n',
  );
  console.log(`Baseline written (${files.length} pages):`);
  for (const rule of RULES) console.log(`  ${String(counts[rule.id]).padStart(5)}  ${rule.label}`);
  process.exit(0);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const regressions = [];
const improvements = [];

for (const rule of RULES) {
  const now = counts[rule.id];
  const was = base.counts[rule.id] ?? 0;
  if (now > was) regressions.push({ rule, now, was });
  else if (now < was) improvements.push({ rule, now, was });
}

console.log(`Design system ratchet — ${files.length} dashboard pages\n`);
for (const rule of RULES) {
  const now = counts[rule.id];
  const was = base.counts[rule.id] ?? 0;
  const delta = now === was ? '=' : now < was ? `-${was - now}` : `+${now - was}`;
  console.log(`  ${String(now).padStart(5)}  (baseline ${String(was).padStart(5)}, ${delta})  ${rule.label}`);
}

if (improvements.length > 0) {
  console.log('\nImproved — run with --update to lock in the lower numbers:');
  for (const { rule, now, was } of improvements) console.log(`  ${rule.label}: ${was} -> ${now}`);
}

if (regressions.length > 0) {
  console.error('\n✗ Design system regression\n');
  for (const { rule, now, was } of regressions) {
    console.error(`  ${rule.label}: ${was} -> ${now} (+${now - was})`);
    console.error(`    ${rule.hint}`);
    const worst = perFile[rule.id].sort((a, b) => b.n - a.n).slice(0, 5);
    for (const { file, n } of worst) console.error(`      ${n.toString().padStart(4)}  ${file}`);
    console.error('');
  }
  console.error('If the increase is genuinely justified, re-record the baseline with');
  console.error('  node scripts/design-system-ratchet.mjs --update');
  console.error('and say why in the commit message.');
  process.exit(1);
}

console.log('\n✓ No regressions.');
