#!/bin/sh
# Run every backup this system takes: the database, and the uploads that the
# database only holds URLs to.
#
# The name is load-bearing. The compose entrypoint calls `backup-db.sh`, and on
# production that entrypoint lives in Coolify's own database rather than in git,
# so it cannot be renamed from here. What this script runs may change freely;
# what it is called may not.
#
# The two legs run as separate processes so neither can stop the other. The
# first version chained the uploads archive onto the end of the dump under
# `set -e`, which quietly made an unreachable database mean no document backup
# either. On staging that is exactly what happened: PGPASSWORD had been empty
# there for a long time, pg_dump failed every night, and the uploads leg was
# never reached even once.
#
# `set -e` is deliberately absent: the job here is to run both legs and report
# on both, not to stop at the first failure.
set -u

dir="$(dirname "$0")"
status=0

sh "$dir/backup-postgres.sh" || {
  echo "[backup] the database backup FAILED — see the error above" >&2
  status=1
}

sh "$dir/backup-uploads.sh" || {
  echo "[backup] the uploads backup FAILED — see the error above" >&2
  status=1
}

exit "$status"
