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
 * This is a static check, so it cannot see an id built at runtime from a
 * template string or useId. Those are correct by construction and simply are
 * not counted here.
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
