// eduspark/scripts/migrate-thumbnails.ts
//
// One-off: move existing course thumbnails (courses/<id>/thumbnail-*) under public/ so they keep
// working once the bucket policy only exposes public/*.
//
//   npx tsx scripts/migrate-thumbnails.ts           # dry run: lists what would move
//   npx tsx scripts/migrate-thumbnails.ts --apply   # copy, update the DB, delete the old object

import * as dotenv from "dotenv";
import path from "path";
import { S3Client, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PUBLIC_PREFIX,
  publicBucket,
  publicObjectUrl,
  keyFromPublicUrl,
} from "../lib/storage/public-objects";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const apply = process.argv.includes("--apply");
  const bucket = publicBucket();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  });

  const courses = await db.course.findMany({
    where: { thumbnail: { not: null } },
    select: { id: true, thumbnail: true },
  });

  let moved = 0;
  for (const c of courses) {
    const oldKey = keyFromPublicUrl(c.thumbnail);
    if (!oldKey || oldKey.startsWith(PUBLIC_PREFIX)) continue; // external URL, or already migrated
    const newKey = `${PUBLIC_PREFIX}${oldKey}`;
    console.log(`${apply ? "MOVE" : "would move"}: ${oldKey}  →  ${newKey}`);
    if (!apply) continue;

    await s3.send(new CopyObjectCommand({ Bucket: bucket, Key: newKey, CopySource: `${bucket}/${oldKey}` }));
    await db.course.update({ where: { id: c.id }, data: { thumbnail: publicObjectUrl(newKey) } });
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: oldKey }));
    moved++;
  }
  console.log(apply ? `\n✔ Moved ${moved} thumbnail(s).` : "\nDry run. Re-run with --apply to move them.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
