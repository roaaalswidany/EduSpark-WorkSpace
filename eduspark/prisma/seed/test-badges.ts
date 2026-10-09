// eduspark/prisma/seed/test-badges.ts
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedBadges } from "./badges";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

async function main() {
  console.log("\n🧪 Testing badges seed...\n");

  await seedBadges(db);

  const count = await db.badge.count();
  console.log(`\n📊 Total badges in DB: ${count}`);

  const sample = await db.badge.findMany({
    select: { key: true, name: true, tier: true },
    orderBy: { tier: "asc" },
  });
  console.log("\n🎖️  Badges:");
  sample.forEach((b) =>
    console.log(`   [${b.tier.padEnd(9)}] ${b.key.padEnd(25)} → ${b.name}`)
  );

  console.log("\n🎉 Done!\n");
}

main()
  .catch((e) => {
    console.error("\n❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });