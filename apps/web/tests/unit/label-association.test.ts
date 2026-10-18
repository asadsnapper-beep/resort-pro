/**
 * A <label htmlFor> that points at nothing is worse than no label.
 *
 * It looks correct in the source and in review, renders the right text on
 * screen, and gives a screen reader nothing — the field is still announced as
 * "edit text, blank". The Settings audit counted roughly 22 such fields, and
 * pairing them by hand is exactly the kind of change where a typo in one id
 * silently undoes the fix for that one field.
 *
 * So the association is checked as an invariant over the whole app rather than
 * trusted per edit: every htmlFor must find exactly one element carrying that
 * id in the same file. Not zero (points at nothing) and not two (ambiguous, and
 * duplicate ids are invalid HTML besides).
 *
 * Ids built from a template are checked too, by comparing the expression text:
 * GatewayCard renders once per gateway, so its fields use
 * id={`${fieldIds}-${field.key}`} with a useId prefix. Whether those come out
 * unique at runtime is useId's contract; whether the label and the control were
 * given the *same* expression is the part a typo can break, and that is what is
 * compared here.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.join(__dirname, '../../src');

function tsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : tsxFiles(p);
    return p.endsWith('.tsx') ? [p] : [];
  });
}

// Only literal attributes: id={`x-${key}`} is built at runtime and is out of scope.
// exec in a loop rather than [...matchAll]: tsconfig targets below es2015, so
// spreading the iterator does not compile even though the test runner is happy.
const attr = (src: string, name: string) => {
  const re = new RegExp(`\\b${name}="([^"]+)"`, 'g');
  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) found.push(m[1]);
  return found;
};

const files = tsxFiles(SRC);

describe('label / control association', () => {
  const broken: string[] = [];
  let pairs = 0;

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf-8');
    const ids = attr(src, 'id');
    for (const target of attr(src, 'htmlFor')) {
      pairs++;
      const matches = ids.filter((id) => id === target).length;
      if (matches !== 1) {
        broken.push(`${path.relative(SRC, file)}: htmlFor="${target}" matches ${matches} id attributes`);
      }
    }
  }

  it('found labels to check, so this does not pass by finding nothing', () => {
    expect(pairs).toBeGreaterThan(15);
  });

  it('every htmlFor points at exactly one control', () => {
    expect(broken).toEqual([]);
  });
});

describe('label / control association built from a template', () => {
  // id={`${prefix}-${field.key}`} on the control, the identical expression on
  // the label. Compared as text: a typo in either half breaks the pair, and a
  // pair that matches is pointing at the same element whatever useId returns.
  const tmpl = (src: string, name: string) => {
    const re = new RegExp(`\\b${name}=\\{(\`[^\`]+\`)\\}`, 'g');
    const found: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) found.push(m[1]);
    return found;
  };

  const broken: string[] = [];
  let pairs = 0;

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf-8');
    const ids = tmpl(src, 'id');
    for (const target of tmpl(src, 'htmlFor')) {
      pairs++;
      if (!ids.includes(target)) {
        broken.push(`${path.relative(SRC, file)}: htmlFor={${target}} has no control with the same id expression`);
      }
    }
  }

  it('found at least one, so the check is doing something', () => {
    expect(pairs).toBeGreaterThan(0);
  });

  it('each one has a control carrying the same expression', () => {
    expect(broken).toEqual([]);
  });
});
