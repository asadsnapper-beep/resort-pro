#!/usr/bin/env bash
#
# Point git at the hooks this repository ships.
#
# Git does not share .git/hooks, so a fresh clone has none. One line per clone
# fixes that, and it is this line:
set -euo pipefail
cd "$(dirname "$0")/.."
git config core.hooksPath .githooks
echo "core.hooksPath = $(git config core.hooksPath)"
echo
echo "Active hooks:"
for h in .githooks/*; do [ -x "$h" ] && echo "  ${h##*/}"; done
echo
echo "Worktrees share this setting, so it only needs running once per clone."
