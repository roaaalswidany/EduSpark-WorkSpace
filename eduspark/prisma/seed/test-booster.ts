// eduspark/prisma/seed/test-booster.ts
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { boostCertificates } from "./certificate-booster";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

async function main(): Promise<void> {
  console.log("\n🧪 Certificate Booster Test\n");

  const withQuiz = await db.course.findMany({
    where: { quiz: { isNot: null } },
  });

  if (withQuiz.length === 0) {
    throw new Error("No courses with quizzes — run Session 3a first.");
  }

  const result = await boostCertificates(db, { withQuiz });

  console.log(`\n📊 Booster summary:`);
  console.log(`   Total added: ${result.totalAdded}`);
  console.log("");
  for (const [email, info] of Object.entries(result.perUser)) {
    console.log(`   ${info.name.padEnd(20)} ${email}`);
    console.log(`     existing: ${info.existing} | added: ${info.added} | final: ${info.final}`);
  }

  console.log(`\n🏆 Final certificate counts (verify):`);
  const demoEmails = [
    "sarah.creator@eduspark.dev",
    "ahmad.student@eduspark.dev",
    "layla.client@eduspark.dev",
    "admin@eduspark.dev",
    "roaaswidany@gmail.com",
  ];

  for (const email of demoEmails) {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`   ❌ ${email}: NOT FOUND`);
      continue;
    }
    const count = await db.certificate.count({ where: { userId: user.id } });
    console.log(`   ✅ ${user.name.padEnd(20)} → ${count} certificates`);
  }

  const totalCerts = await db.certificate.count();
  const totalEnrollments = await db.enrollment.count();
  const totalAttempts = await db.quizAttempt.count();

  console.log(`\n📈 DB Totals:`);
  console.log(`   Enrollments:    ${totalEnrollments}`);
  console.log(`   QuizAttempts:   ${totalAttempts}`);
  console.log(`   Certificates:   ${totalCerts}`);

  console.log("\n🎉 Booster test complete!\n");
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