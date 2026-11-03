-- Idempotent: safe to run even if the column/index/FK already exist.
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "lessonId" TEXT;

CREATE INDEX IF NOT EXISTS "attachments_lessonId_idx" ON "attachments"("lessonId");

DO $$ BEGIN
  ALTER TABLE "attachments"
    ADD CONSTRAINT "attachments_lessonId_fkey"
    FOREIGN KEY ("lessonId") REFERENCES "lessons"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;