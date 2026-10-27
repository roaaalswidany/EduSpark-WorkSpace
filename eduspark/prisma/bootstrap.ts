// Run on every deployment, after `prisma migrate deploy`:  npm run bootstrap
// Next.js reads .env.local; plain `dotenv/config` would only read .env
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureBaseData } from "../lib/bootstrap/ensure-base-data";

async function main() {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
    const r = await ensureBaseData(db, {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      name: process.env.ADMIN_NAME,
    });
    console.log(`[bootstrap] badges=${r.badges} categories=${r.categories} admin=${r.admin}`);
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => { console.error("[bootstrap] failed:", e); process.exit(1); });
