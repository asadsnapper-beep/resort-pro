#!/bin/sh
# Take one PostgreSQL backup, verify it, and prune old ones.
#
# Runs inside a postgres:16-alpine sidecar (see the `backup` service in the
# compose files) so it needs nothing installed on the host.
#
# Custom format (-Fc) rather than plain SQL: it is compressed, it can be
# restored selectively, and `pg_restore --list` can prove the file is readable
# without restoring it. A backup nobody has ever read is not a backup, so that
# check runs on every dump and a failed verify deletes the file and exits
# non-zero — a loud failure beats a directory full of corrupt dumps.
set -eu

: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_USER:=resortpro}"
: "${POSTGRES_DB:=resortpro}"
: "${BACKUP_DIR:=/backups}"
: "${BACKUP_RETENTION_DAYS:=14}"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$BACKUP_DIR/${POSTGRES_DB}-${stamp}.dump"

mkdir -p "$BACKUP_DIR"

echo "[backup] dumping $POSTGRES_DB from $POSTGRES_HOST → $file"
pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$file"

# Verify before trusting it. pg_restore --list parses the archive's table of
# contents, so a truncated or corrupt dump fails here rather than during the
# outage when it is actually needed.
if ! pg_restore --list "$file" > /dev/null 2>&1; then
  echo "[backup] FAILED verification, removing $file" >&2
  rm -f "$file"
  exit 1
fi

size="$(wc -c < "$file" | tr -d ' ')"
tables="$(pg_restore --list "$file" | grep -c 'TABLE DATA' || true)"
echo "[backup] ok — ${size} bytes, ${tables} tables with data"

# Prune only verified-good older dumps.
deleted="$(find "$BACKUP_DIR" -name "${POSTGRES_DB}-*.dump" -type f -mtime "+${BACKUP_RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')"
echo "[backup] pruned ${deleted} dump(s) older than ${BACKUP_RETENTION_DAYS} days"
