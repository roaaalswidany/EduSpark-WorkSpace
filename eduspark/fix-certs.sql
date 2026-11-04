UPDATE "certificates"
SET "credentialId" = 'EDU-' || upper(substring(md5(random()::text) from 1 for 8))
WHERE "credentialId" IS NULL OR "credentialId" NOT LIKE 'EDU-%';