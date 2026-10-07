// eduspark/prisma/seed/test-session-4b.ts
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedOrders } from "./orders";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

async function main(): Promise<void> {
  console.log("\n🧪 Session 4b Test Runner\n");

  const student = await db.user.findUniqueOrThrow({
    where: { email: "ahmad.student@eduspark.dev" },
  });
  const client = await db.user.findUniqueOrThrow({
    where: { email: "layla.client@eduspark.dev" },
  });
  const instructor = await db.user.findUniqueOrThrow({
    where: { email: "sarah.creator@eduspark.dev" },
  });
  const students = await db.user.findMany({
    where: {
      role: "STUDENT",
      email: { notIn: ["ahmad.student@eduspark.dev", "layla.client@eduspark.dev"] },
    },
  });
  const creators = await db.user.findMany({
    where: {
      role: "CREATOR",
      email: { not: "sarah.creator@eduspark.dev" },
    },
  });
  const services = await db.service.findMany();

  if (services.length === 0) {
    throw new Error("No services found — run Session 4a first.");
  }

  const result = await seedOrders(
    db,
    { student, client, students, creators, instructor },
    { all: services }
  );

  console.log(`\n📊 Orders summary:`);
  console.log(`   Total:      ${result.stats.orders}`);
  console.log(`   Projects:   ${result.stats.projects}`);
  console.log(`   Milestones: ${result.stats.milestones}`);
  console.log(`   Proposals:  ${result.stats.proposals}`);

  console.log(`\n📋 Orders by status:`);
  for (const [status, count] of Object.entries(result.stats.byOrderStatus)) {
    console.log(`   ${status.padEnd(12)} → ${count}`);
  }

  console.log(`\n📋 Projects by status:`);
  for (const [status, count] of Object.entries(result.stats.byProjectStatus)) {
    console.log(`   ${status.padEnd(12)} → ${count}`);
  }

  // Sample check
  const sampleProject = await db.project.findFirst({
    where: { status: "IN_PROGRESS" },
    include: {
      client: { select: { name: true } },
      creator: { select: { name: true } },
      milestones: { orderBy: { order: "asc" } },
    },
  });

  if (sampleProject) {
    console.log(`\n🔍 Sample project:`);
    console.log(`   Title:   ${sampleProject.title.slice(0, 60)}`);
    console.log(`   Client:  ${sampleProject.client.name}`);
    console.log(`   Creator: ${sampleProject.creator?.name ?? "(none)"}`);
    console.log(`   Budget:  $${sampleProject.budget}`);
    console.log(`   Milestones: ${sampleProject.milestones.length}`);
    sampleProject.milestones.forEach((m) => {
      console.log(`     [${m.order}] ${m.title} (${m.status}) — $${m.amount}`);
    });
  }

  const sampleOpenProject = await db.project.findFirst({
    where: { status: "OPEN" },
    include: {
      client: { select: { name: true } },
      proposals: {
        include: { creator: { select: { name: true } } },
      },
    },
  });

  if (sampleOpenProject) {
    console.log(`\n🔍 Sample open project:`);
    console.log(`   Title: ${sampleOpenProject.title}`);
    console.log(`   Client: ${sampleOpenProject.client.name}`);
    console.log(`   Proposals: ${sampleOpenProject.proposals.length}`);
    sampleOpenProject.proposals.forEach((p) => {
      console.log(
        `     - ${p.creator.name}: $${p.price} in ${p.deliveryDays}d ${p.isAccepted ? "✅ accepted" : ""}`
      );
    });
  }

  console.log("\n🎉 Session 4b test complete!\n");
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