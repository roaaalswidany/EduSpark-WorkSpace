// eduspark/scripts/apply-storage-policy.ts
//
// Makes ONLY the `public/` prefix of the bucket anonymously readable (course thumbnails).
// Everything else (milestone/chat/lesson attachments) stays private.
//
//   npx tsx scripts/apply-storage-policy.ts           # show the policy, change nothing
//   npx tsx scripts/apply-storage-policy.ts --apply   # apply it
//
// WARNING: PutBucketPolicy REPLACES the bucket's whole policy. If you previously made the entire
// bucket public (e.g. in the MinIO console), run scripts/migrate-thumbnails.ts --apply FIRST so
// existing thumbnails move under public/ and keep working.

import * as dotenv from "dotenv";
import path from "path";
import { S3Client, PutBucketPolicyCommand } from "@aws-sdk/client-s3";
import { PUBLIC_PREFIX, publicBucket } from "../lib/storage/public-objects";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const apply = process.argv.includes("--apply");
  const bucket = publicBucket();
  if (!bucket) throw new Error("S3_PUBLIC_BUCKET or S3_BUCKET_NAME must be set.");

  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "PublicReadThumbnailsOnly",
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${bucket}/${PUBLIC_PREFIX}*`],
      },
    ],
  };

  console.log(JSON.stringify(policy, null, 2));
  if (!apply) {
    console.log("\nDry run. Re-run with --apply to set this policy on bucket:", bucket);
    return;
  }

  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  });
  await client.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: JSON.stringify(policy) }));
  console.log(`\n✔ Policy applied: only s3://${bucket}/${PUBLIC_PREFIX}* is publicly readable.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
