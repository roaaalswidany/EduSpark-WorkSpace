/**
 * Creates the first admin and/or promotes an existing account.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='at-least-12-chars' npx tsx scripts/setup-admin.ts
 *   PROMOTE_EMAIL=you@example.com npx tsx scripts/setup-admin.ts      # promote an existing user only
 *
 * No credentials or personal data live in this file (it is in a public repository).
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureAdmin, promoteToAdmin } from "../lib/bootstrap/ensure-base-data";

async function main() {
  const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, PROMOTE_EMAIL } = process.env;
  if (!DATABASE_URL) throw new Error("DATABASE_URL is not defined.");
  if (!(ADMIN_EMAIL && ADMIN_PASSWORD) && !PROMOTE_EMAIL) {
    throw new Error("Nothing to do: set ADMIN_EMAIL + ADMIN_PASSWORD (create) and/or PROMOTE_EMAIL (promote).");
  }

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
  try {
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      // ensureAdmin enforces: password >= 12 chars, never overwrites an existing account.
      const r = await ensureAdmin(db, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: ADMIN_NAME });
      console.log(`admin: ${r}`);
    }
    if (PROMOTE_EMAIL) console.log(`promote ${PROMOTE_EMAIL}: ${await promoteToAdmin(db, PROMOTE_EMAIL)}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("setup-admin failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
