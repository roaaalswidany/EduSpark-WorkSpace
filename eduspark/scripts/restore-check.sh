#!/usr/bin/env bash
# EduSpark restore drill — proves a backup can actually be restored.
# Restores the newest dump into a THROWAWAY database (never touches the live one),
# compares row counts with the ones recorded at backup time, then drops it.
#
#   ./scripts/restore-check.sh                      # newest dump in ./backups
#   ./scripts/restore-check.sh backups/db-XXXX.dump # a specific dump
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
PG_CONTAINER="${PG_CONTAINER:-eduspark-postgres}"
PG_USER="${PG_USER:-eduspark}"
SCRATCH="eduspark_restore_check"

DUMP="${1:-$(ls -t "$BACKUP_DIR"/db-*.dump 2>/dev/null | head -1 || true)}"
[ -n "$DUMP" ] && [ -s "$DUMP" ] || { echo "No dump found in $BACKUP_DIR" >&2; exit 1; }
COUNTS="$DUMP.counts"
[ -s "$COUNTS" ] || { echo "Missing $COUNTS (created by backup.sh)" >&2; exit 1; }

psql_admin() { docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 "$@"; }
cleanup() { psql_admin -c "DROP DATABASE IF EXISTS $SCRATCH;" > /dev/null 2>&1 || true; }
trap cleanup EXIT

echo "Restoring $DUMP into scratch database $SCRATCH …"
psql_admin -c "DROP DATABASE IF EXISTS $SCRATCH;" -c "CREATE DATABASE $SCRATCH;" > /dev/null
docker exec -i "$PG_CONTAINER" pg_restore -U "$PG_USER" -d "$SCRATCH" --no-owner --exit-on-error < "$DUMP"

FAIL=0
printf '%-14s %10s %10s\n' table at_backup restored
while IFS='=' read -r TABLE EXPECTED; do
  ACTUAL="$(docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$SCRATCH" -tA -c "SELECT count(*) FROM $TABLE;")"
  STATUS="ok"
  # The counts are taken just BEFORE the dump, so restored rows must be >= counted rows.
  if [ "$ACTUAL" -lt "$EXPECTED" ]; then STATUS="MISSING ROWS"; FAIL=1; fi
  printf '%-14s %10s %10s  %s\n' "$TABLE" "$EXPECTED" "$ACTUAL" "$STATUS"
done < "$COUNTS"

if [ "$FAIL" -ne 0 ]; then echo "RESTORE CHECK FAILED" >&2; exit 1; fi
echo "RESTORE CHECK PASSED — the backup is restorable."
