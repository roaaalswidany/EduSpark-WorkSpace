-- Admin review gate for courses (Competency-Verified Authorization).
-- New lifecycle: DRAFT -> PENDING_REVIEW -> PUBLISHED (admin only) / back to DRAFT (rejected).
-- Existing PUBLISHED / DRAFT / ARCHIVED rows are untouched.

ALTER TYPE "CourseStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';

ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "submittedAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewNote"   TEXT;
