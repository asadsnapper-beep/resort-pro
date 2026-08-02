#!/usr/bin/env python3
"""
ResortPro Color Token Migration
Replaces hardcoded hex/rgba colors in inline style={{ }} with CSS var(--rp-*) tokens.
Only touches values inside style prop strings — skips className and comments.
"""

import re
import os
import glob

# Token mapping: old value → new var()
# Order matters — more specific first
REPLACEMENTS = [
    # Text colors
    ("'#18231f'",  "'var(--rp-text)'"),
    ('"#18231f"',  '"var(--rp-text)"'),
    ("'#8aa29a'",  "'var(--rp-text-muted)'"),
    ('"#8aa29a"',  '"var(--rp-text-muted)"'),
    ("'#7a9890'",  "'var(--rp-text-muted)'"),
    ('"#7a9890"',  '"var(--rp-text-muted)"'),
    ("'#6b8880'",  "'var(--rp-text-subtle)'"),
    ('"#6b8880"',  '"var(--rp-text-subtle)"'),
    ("'#4a6e66'",  "'var(--rp-text-accent)'"),
    ('"#4a6e66"',  '"var(--rp-text-accent)"'),
    ("'#b5afa7'",  "'var(--rp-text-faint)'"),
    ('"#b5afa7"',  '"var(--rp-text-faint)"'),
    ("'#c5bdb4'",  "'var(--rp-text-faint)'"),
    ('"#c5bdb4"',  '"var(--rp-text-faint)"'),
    ("'#d6cfc4'",  "'var(--rp-text-faint)'"),
    ('"#d6cfc4"',  '"var(--rp-text-faint)"'),

    # Surfaces — more specific first
    ("'#faf9f7'",  "'var(--rp-surface-2)'"),
    ('"#faf9f7"',  '"var(--rp-surface-2)"'),
    ("'#fafaf8'",  "'var(--rp-surface-2)'"),
    ('"#fafal8"',  '"var(--rp-surface-2)"'),
    ("'#f4f1eb'",  "'var(--rp-surface-3)'"),
    ('"#f4f1eb"',  '"var(--rp-surface-3)"'),
    ("'#f5f4f1'",  "'var(--rp-surface-3)'"),
    ('"#f5f4f1"',  '"var(--rp-surface-3)"'),
    ("'#f0ede8'",  "'var(--rp-surface-4)'"),
    ('"#f0ede8"',  '"var(--rp-surface-4)"'),
    ("'#f5faf9'",  "'var(--rp-teal-soft)'"),
    ('"#f5faf9"',  '"var(--rp-teal-soft)"'),
    ("'#ffffff'",  "'var(--rp-surface)'"),
    ('"#ffffff"',  '"var(--rp-surface)"'),
    ("'#fff'",     "'var(--rp-surface)'"),
    ('"#fff"',     '"var(--rp-surface)"'),

    # Status backgrounds
    ("'#e3f2ef'",  "'var(--rp-teal-bg)'"),
    ('"#e3f2ef"',  '"var(--rp-teal-bg)"'),
    ("'#f4ecda'",  "'var(--rp-amber-bg)'"),
    ('"#f4ecda"',  '"var(--rp-amber-bg)"'),
    ("'#fef2f2'",  "'var(--rp-red-bg)'"),
    ('"#fef2f2"',  '"var(--rp-red-bg)"'),
    ("'#fceee4'",  "'var(--rp-coral-bg)'"),
    ('"#fceee4"',  '"var(--rp-coral-bg)"'),

    # Borders — standalone borderColor values only
    ("'rgba(0,0,0,0.045)'", "'var(--rp-border)'"),
    ("'rgba(0,0,0,0.05)'",  "'var(--rp-border)'"),
    ("'rgba(0,0,0,0.06)'",  "'var(--rp-border)'"),
    ("'rgba(0,0,0,0.07)'",  "'var(--rp-border)'"),
    ("'rgba(0,0,0,0.08)'",  "'var(--rp-border-md)'"),
    ("'rgba(0,0,0,0.09)'",  "'var(--rp-border-md)'"),
]

# Files to migrate
BASE = "/Users/parthohore/Hotel management/apps/web/src"
PATTERNS = [
    f"{BASE}/app/(dashboard)/dashboard/**/*.tsx",
    f"{BASE}/components/**/*.tsx",
]

def get_files():
    files = []
    for p in PATTERNS:
        files.extend(glob.glob(p, recursive=True))
    return sorted(set(files))

def migrate_file(path):
    with open(path, 'r') as f:
        original = f.read()

    content = original
    changes = []

    for old, new in REPLACEMENTS:
        if old in content:
            count = content.count(old)
            content = content.replace(old, new)
            changes.append(f"  {old} → {new}  ({count}x)")

    if content != original:
        with open(path, 'w') as f:
            f.write(content)
        rel = path.replace("/Users/parthohore/Hotel management/", "")
        print(f"\n✓ {rel}")
        for c in changes:
            print(c)
        return len(changes)
    return 0

def main():
    files = get_files()
    print(f"Scanning {len(files)} files...\n")

    total_files = 0
    total_changes = 0

    for f in files:
        n = migrate_file(f)
        if n > 0:
            total_files += 1
            total_changes += n

    print(f"\n{'='*60}")
    print(f"Done. {total_files} files modified, {total_changes} replacement types applied.")

if __name__ == '__main__':
    main()
