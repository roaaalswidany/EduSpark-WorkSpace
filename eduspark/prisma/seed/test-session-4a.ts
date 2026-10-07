// eduspark/prisma/seed/test-session-4a.ts
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedServices } from "./services";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

async function main(): Promise<void> {
  console.log("\n🧪 Session 4a Test Runner\n");

  const instructor = await db.user.findUniqueOrThrow({
    where: { email: "sarah.creator@eduspark.dev" },
  });
  const creators = await db.user.findMany({
    where: { role: "CREATOR", email: { not: "sarah.creator@eduspark.dev" } },
  });
  const categories = await db.category.findMany();

  if (creators.length === 0 || categories.length === 0) {
    throw new Error("Missing prerequisites — run Session 2 first.");
  }

  const services = await seedServices(db, { instructor, creators }, categories);

  console.log(`\n📊 Services summary:`);
  console.log(`   Total:   ${services.all.length}`);
  console.log(`   Arabic:  ${services.arabic.length}`);
  console.log(`   English: ${services.english.length}`);

  console.log(`\n🔍 Sample services:`);
  [0, 5, 15, 20, 30, 39].forEach((i) => {
    const s = services.all[i];
    if (s)
      console.log(
        `   [${i}] ${s.title.slice(0, 55)} | $${s.price} | ${s.deliveryDays}d`
      );
  });

  // Check creator distribution
  const creatorsWithServices = await db.user.findMany({
    where: { services: { some: {} } },
    select: {
      name: true,
      _count: { select: { services: true } },
    },
    orderBy: { services: { _count: "desc" } },
    take: 5,
  });

  console.log(`\n👥 Top creators by service count:`);
  creatorsWithServices.forEach((c) => {
    console.log(`   ${c.name.padEnd(25)} → ${c._count.services} services`);
  });

  // Category distribution
  const byCategory = await db.service.groupBy({
    by: ["categoryId"],
    _count: true,
  });

  console.log(`\n📂 Services by category: ${byCategory.length} categories`);

  const totalServices = await db.service.count();
  const activeServices = await db.service.count({
    where: { status: "ACTIVE" },
  });

  console.log(`\n📈 Totals in DB:`);
  console.log(`   Services: ${totalServices} (${activeServices} active)`);

  console.log("\n🎉 Session 4a test complete!\n");
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