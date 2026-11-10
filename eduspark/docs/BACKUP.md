# Backup & Restore

> **Status:** the scripts below exist and their logic was exercised with a stubbed `docker`
> (no real database). A **real restore drill has not been recorded yet** — run it once and fill in
> the table at the bottom before claiming the backups work.

## What to back up

| Data | Where | How |
|---|---|---|
| PostgreSQL (users, courses, certificates, projects, audit log) | container `eduspark-postgres` | `scripts/backup.sh` (custom-format `pg_dump`) |
| Uploaded files (attachments, thumbnails) | MinIO bucket `S3_BUCKET_NAME` | `MINIO_BACKUP=1 scripts/backup.sh` (`mc mirror`) |
| Redis | cache + rate-limit counters only | **not backed up** — it can be rebuilt |
| Secrets (`.env.local`) | your machine / secret manager | keep **outside** git, in a password manager |

## Create a backup

Run with **bash** (Linux, macOS, WSL, or Git Bash on Windows):

```bash
cd eduspark
./scripts/backup.sh                                   # database only
MINIO_BACKUP=1 MINIO_ROOT_USER=… MINIO_ROOT_PASSWORD=… ./scripts/backup.sh   # + uploaded files
```

Output: `backups/db-<timestamp>.dump` and `backups/db-<timestamp>.dump.counts` (row counts at backup
time). The script refuses an **empty** dump, verifies the archive is readable (`pg_restore --list`),
and deletes dumps older than `RETENTION_DAYS` (default 7). `backups/` and `*.sql` are git-ignored —
never commit a backup (it contains personal data).

Schedule it (Linux server): `0 3 * * * cd /srv/eduspark/eduspark && ./scripts/backup.sh >> /var/log/eduspark-backup.log 2>&1`

## Prove it can be restored (do this, don't skip it)

```bash
./scripts/restore-check.sh            # newest dump
```

It restores into a **throwaway database** (`eduspark_restore_check`), compares `users`, `courses`,
`certificates`, `enrollments` with the counts saved at backup time, prints a table, and drops the
scratch database. It never touches the live database. A backup that was never restored is not a backup.

## Restore for real (disaster recovery)

1. Stop the app (`docker compose stop web` or stop `npm start`), so nothing writes during the restore.
2. Recreate an empty database:
   ```bash
   docker exec eduspark-postgres psql -U eduspark -d postgres -c "DROP DATABASE IF EXISTS eduspark;" -c "CREATE DATABASE eduspark;"
   ```
3. Restore:
   ```bash
   docker exec -i eduspark-postgres pg_restore -U eduspark -d eduspark --no-owner --exit-on-error < backups/db-<timestamp>.dump
   ```
4. Uploaded files: copy the mirrored folder back with `mc mirror /backup src/<bucket>` (same container
   trick as in `backup.sh`, source and destination swapped).
5. Start the app and run `npx prisma migrate status` — it must say the database is up to date.

### Windows PowerShell note
Do **not** use `>` or `<` with binary dumps in PowerShell 5 — it re-encodes the bytes and corrupts the
file. Either use Git Bash/WSL for the scripts above, or copy through the container:

```powershell
docker exec eduspark-postgres pg_dump -U eduspark -d eduspark --format=custom --no-owner -f /tmp/eduspark.dump
docker cp eduspark-postgres:/tmp/eduspark.dump .\backups\eduspark.dump
```

## Targets (decide and write the real numbers)

- **RPO** (maximum data you can afford to lose): with a nightly backup it is up to 24 h.
- **RTO** (time to be back up): measure it during the drill — start the clock at "stop the app".

## Restore drill log

| Date | Dump file | Restore check | Time to restore | Done by |
|---|---|---|---|---|
| _fill in_ | | PASSED / FAILED | | |


---

## Restore Verification Log

**Test Environment:** Local Docker (PostgreSQL 16, MinIO/SILO, Redis 7)  
**Test Date:** 2026-11-07 05:17:49 (local)  
**Tester:** Roaa Al-Swidany  

### Backup
- **Command:** `bash scripts/backup.sh`
- **Output:** `./backups/db-20261107_051749.dump` (244 KB)
- **Scope:** PostgreSQL database only (not MinIO objects)

### Restore Check
- **Command:** `bash scripts/restore-check.sh`
- **Method:** pg_restore into scratch database `eduspark_restore_check`
- **Duration:** ~2 seconds

### Row Count Verification

| Table | At Backup | After Restore | Match |
|-------|-----------|---------------|-------|
| users | 85 | 85 | ✅ |
| courses | 30 | 30 | ✅ |
| certificates | 36 | 36 | ✅ |
| enrollments | 264 | 264 | ✅ |

**Verdict:** ✅ **PASS** — the backup is restorable and row counts match exactly.

### Known Limitations
- The drill above covered the **PostgreSQL database only**. `scripts/backup.sh` can also mirror the MinIO bucket (`MINIO_BACKUP=1 MINIO_ROOT_USER=… MINIO_ROOT_PASSWORD=… ./scripts/backup.sh`), but **that path has not been drilled yet** — run it once and add a row for it here before relying on it for uploaded files (attachments, thumbnails).
- Row counts matching proves the data came back; it does not prove the application works against the restored database. For a full drill, point a copy of the app at `eduspark_restore_check` and log in.
