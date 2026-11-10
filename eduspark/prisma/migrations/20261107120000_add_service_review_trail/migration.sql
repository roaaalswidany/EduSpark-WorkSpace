-- Review trail for the service review gate (PENDING_REVIEW already exists as an enum value).
ALTER TABLE "services"
  ADD COLUMN IF NOT EXISTS "submittedAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewNote"   TEXT;
