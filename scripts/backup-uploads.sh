#!/bin/sh
# Archive the uploads volume — the half of a backup that pg_dump does not cover.
#
# guest_documents rows carry a URL; the passport and ID photos those URLs point
# at live on disk in the uploads volume. Dumping only Postgres therefore keeps
# every row and loses every image, which is the worst possible shape for a
# restore: it looks like it worked, and each guest document is a broken link.
#
# Not gzipped. The payload is JPEG/PNG/WebP, already compressed — gzip would
# spend CPU to save close to nothing.
#
# A missing mount is a hard failure, not a skip. Quietly backing up nothing is
# precisely the bug this script exists to close, so it must be loud.
set -eu

: "${UPLOADS_DIR:=/app/uploads}"
: "${BACKUP_DIR:=/backups}"
: "${BACKUP_RETENTION_DAYS:=14}"

if [ ! -d "$UPLOADS_DIR" ]; then
  echo "[backup] uploads dir $UPLOADS_DIR is not mounted — guest documents are NOT backed up" >&2
  echo "[backup] fix: add '- uploads_data:/app/uploads:ro' to the backup service's volumes" >&2
  exit 1
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$BACKUP_DIR/uploads-${stamp}.tar"

mkdir -p "$BACKUP_DIR"

echo "[backup] archiving $UPLOADS_DIR → $file"
tar -cf "$file" -C "$UPLOADS_DIR" .

# Same discipline as the dump: prove the archive reads back before keeping it.
if ! tar -tf "$file" > /dev/null 2>&1; then
  echo "[backup] FAILED verification, removing $file" >&2
  rm -f "$file"
  exit 1
fi

size="$(wc -c < "$file" | tr -d ' ')"
files="$(tar -tf "$file" | grep -vc '/$' || true)"
echo "[backup] ok — ${size} bytes, ${files} file(s)"

# Prune only verified-good older archives.
deleted="$(find "$BACKUP_DIR" -name 'uploads-*.tar' -type f -mtime "+${BACKUP_RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')"
echo "[backup] pruned ${deleted} upload archive(s) older than ${BACKUP_RETENTION_DAYS} days"
