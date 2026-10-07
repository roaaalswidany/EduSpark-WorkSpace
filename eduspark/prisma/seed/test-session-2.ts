/* eslint-disable @typescript-eslint/no-unused-vars */
// eduspark/prisma/seed/test-session-2.ts
// Temporary test runner for Session 2 modules.

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config(); // fallback to .env

import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedUsers } from "./users";
import { seedCategories } from "./categories";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

async function main(): Promise<void> {
  console.log("\n🧪 Session 2 Test Runner\n");

  // Verify connection string
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — check eduspark/.env.local");
  }
  console.log(`✅ DATABASE_URL loaded (${process.env.DATABASE_URL.slice(0, 30)}...)\n`);

  const users = await seedUsers(db);
  console.log(`\n📊 Users summary:`);
  console.log(`   Total: ${users.all.length}`);
  console.log(`   Students: ${users.students.length}`);
  console.log(`   Creators: ${users.creators.length}`);

  console.log(`\n🔍 Sample check:`);
  console.log(`   [0]   ${users.all[0].name} (${users.all[0].role})`);
  console.log(`   [4]   ${users.all[4].name} (${users.all[4].role})`);
  console.log(`   [10]  ${users.all[10].name} (${users.all[10].role})`);
  console.log(`   [50]  ${users.all[50].name} (${users.all[50].role})`);
  console.log(`   [80]  ${users.all[80].name} (${users.all[80].role})`);

  const categories = await seedCategories(db);
  console.log(`\n📋 Categories:`);
  categories.forEach((c) => console.log(`   ${c.name} → /${c.slug}`));

  // Language distribution check
  const arabicUsers = users.all.filter((u) =>
    /[\u0600-\u06FF]/.test(u.name)
  ).length;
  console.log(`\n🌍 Language distribution:`);
  console.log(`   Arabic-named users: ${arabicUsers}`);
  console.log(`   English-named users: ${users.all.length - arabicUsers}`);

  console.log("\n🎉 Session 2 test complete!\n");
}

main()
  .catch((e) => {
    console.error("\n❌ Test failed:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });