# Backup & Disaster Recovery — EduSpark

> **Status**: Documented + testable.
> **Owner**: Platform Admin.

## 1. What to back up

| Asset | Data | Frequency | Retention |
|---|---|---|---|
| PostgreSQL | Users, courses, orders, certificates | **Nightly** | 7 daily, 4 weekly, 12 monthly |
| MinIO (S3) | Attachments, thumbnails | **Weekly** | 4 weekly |
| Env files (.env.local) | Secrets | **On change** | Encrypted in password manager |
| Code | Source + migrations | **Every push** | GitHub + tags |

**Do NOT back up**: `.next/`, `node_modules/`, Docker caches.

---

## 2. Automated backup script (scripts/backup.sh)

```bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR:-/opt/eduspark/backups}"
STAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# 1. PostgreSQL
docker exec eduspark-postgres pg_dump -U eduspark -d eduspark \
  --format=custom --no-owner --file=/tmp/db-$STAMP.dump
docker cp "eduspark-postgres:/tmp/db-$STAMP.dump" "$BACKUP_DIR/"
docker exec eduspark-postgres rm "/tmp/db-$STAMP.dump"

# 2. MinIO (weekly)
if [ "$(date +%u)" = "7" ]; then
  docker run --rm --network eduspark-network \
    -v "$BACKUP_DIR/minio:/backup" minio/mc mirror --overwrite \
    http://minio:9000/eduspark-uploads /backup
fi

# 3. Retention
find "$BACKUP_DIR" -name "db-*.dump" -mtime +7 -delete

# 4. Sanity check
LATEST=$(ls -t "$BACKUP_DIR"/db-*.dump | head -1)
[ -s "$LATEST" ] || { echo "BACKUP EMPTY"; exit 1; }
echo "OK: $LATEST"