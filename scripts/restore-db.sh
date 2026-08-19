#!/bin/sh
# Restore a backup into a target database.
#
#   sh scripts/restore-db.sh <dump-file> <target-db>
#
# The target database is REQUIRED and never defaults. Restoring is the one
# operation where a convenient default is a hazard: the obvious default would
# be the production database, and the common case for running this is a
# rehearsal into a scratch database. Making it explicit costs one argument.
#
# --clean --if-exists so a repeat restore into the same scratch database is
# repeatable rather than colliding on existing objects.
set -eu

file="${1:-}"
target="${2:-}"

if [ -z "$file" ] || [ -z "$target" ]; then
  echo "usage: restore-db.sh <dump-file> <target-db>" >&2
  exit 2
fi
[ -f "$file" ] || { echo "no such dump: $file" >&2; exit 2; }

: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_USER:=resortpro}"

echo "[restore] verifying $file"
pg_restore --list "$file" > /dev/null

echo "[restore] $file → database '$target' on $POSTGRES_HOST"
pg_restore -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$target" \
  --clean --if-exists --no-owner --no-privileges "$file"

echo "[restore] done — verify row counts before trusting it"
