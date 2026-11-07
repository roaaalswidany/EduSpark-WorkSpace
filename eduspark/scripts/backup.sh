#!/usr/bin/env bash
# EduSpark backup — PostgreSQL every run, MinIO bucket when MINIO_BACKUP=1.
#
#   ./scripts/backup.sh                    # database only
#   MINIO_BACKUP=1 MINIO_ROOT_USER=… MINIO_ROOT_PASSWORD=… ./scripts/backup.sh
#
# Defaults match eduspark-infra/docker-compose.yml. Override with environment variables.
# Run it with bash (Linux, macOS, WSL or Git Bash on Windows).
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
PG_CONTAINER="${PG_CONTAINER:-eduspark-postgres}"
PG_USER="${PG_USER:-eduspark}"
PG_DB="${PG_DB:-eduspark}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
STAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/db-$STAMP.dump"

# Row counts at backup time: the restore check compares against these.
count() { docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -tA -c "SELECT count(*) FROM $1;"; }
{
  echo "users=$(count users)"
  echo "courses=$(count courses)"
  echo "certificates=$(count certificates)"
  echo "enrollments=$(count enrollments)"
} > "$OUT.counts"

# 1) PostgreSQL — custom format streamed to a file on the host (no temp file in the container).
docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" -d "$PG_DB" --format=custom --no-owner > "$OUT.partial"
if [ ! -s "$OUT.partial" ]; then
  echo "BACKUP EMPTY" >&2
  rm -f "$OUT.partial" "$OUT.counts"
  exit 1
fi
mv "$OUT.partial" "$OUT"

# 2) Prove the archive is readable (lists its table of contents).
if ! docker exec -i "$PG_CONTAINER" pg_restore --list < "$OUT" > /dev/null; then
  echo "BACKUP CORRUPT: $OUT" >&2
  exit 1
fi

# 3) MinIO objects (attachments, thumbnails) — optional, weekly is enough.
if [ "${MINIO_BACKUP:-0}" = "1" ]; then
  : "${MINIO_ROOT_USER:?set MINIO_ROOT_USER}"
  : "${MINIO_ROOT_PASSWORD:?set MINIO_ROOT_PASSWORD}"
  BUCKET="${S3_BUCKET_NAME:-eduspark-uploads}"
  NETWORK="${DOCKER_NETWORK:-eduspark-network}"
  MINIO_HOST="${MINIO_CONTAINER:-eduspark-minio}"
  mkdir -p "$BACKUP_DIR/minio"
  docker run --rm --network "$NETWORK" \
    -e "MC_HOST_src=http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@${MINIO_HOST}:9000" \
    -v "$(cd "$BACKUP_DIR" && pwd)/minio:/backup" \
    minio/mc mirror --overwrite "src/$BUCKET" /backup
fi

# 4) Retention.
find "$BACKUP_DIR" -maxdepth 1 \( -name 'db-*.dump' -o -name 'db-*.dump.counts' \) -mtime +"$RETENTION_DAYS" -delete

echo "OK: $OUT ($(du -h "$OUT" | cut -f1))"
