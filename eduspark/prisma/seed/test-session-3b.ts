// eduspark/prisma/seed/test-session-3b.ts
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedEnrollments } from "./enrollments";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

async function main(): Promise<void> {
  console.log("\n🧪 Session 3b Test Runner\n");

  const student = await db.user.findUniqueOrThrow({
    where: { email: "ahmad.student@eduspark.dev" },
  });
  const students = await db.user.findMany({
    where: {
      role: "STUDENT",
      email: { not: "ahmad.student@eduspark.dev" },
    },
  });
  const client = await db.user.findUniqueOrThrow({
    where: { email: "layla.client@eduspark.dev" },
  });

  const courses = await db.course.findMany();
  const withQuiz = await db.course.findMany({
    where: { quiz: { isNot: null } },
  });

  if (courses.length === 0) {
    throw new Error("No courses found — run Session 3a first.");
  }

  const result = await seedEnrollments(
    db,
    { student, students, client },
    { all: courses, withQuiz }
  );

  console.log(`\n📊 Enrollments summary:`);
  console.log(`   Total:        ${result.stats.total}`);
  console.log(`   Active:       ${result.stats.active}`);
  console.log(`   Completed:    ${result.stats.completed}`);
  console.log(`   Certificates: ${result.stats.certificates}`);

  // Sample certificate check
  const sampleCert = await db.certificate.findFirst({
    include: {
      user: { select: { name: true, email: true } },
      course: { select: { title: true, language: true } },
    },
  });

  if (sampleCert) {
    console.log(`\n🏆 Sample certificate:`);
    console.log(`   User: ${sampleCert.user.name}`);
    console.log(`   Course: ${sampleCert.course.title} (${sampleCert.course.language})`);
    console.log(`   Score: ${sampleCert.score}%`);
    console.log(`   Credential: ${sampleCert.credentialId}`);
  }

  // Totals in DB
  const totalProgress = await db.lessonProgress.count();
  const totalAttempts = await db.quizAttempt.count();

  console.log(`\n📈 Totals in DB:`);
  console.log(`   LessonProgress: ${totalProgress}`);
  console.log(`   QuizAttempts:   ${totalAttempts}`);
  console.log(`   Certificates:   ${result.stats.certificates}`);

  // Language distribution of certificates
  const arabicCerts = await db.certificate.count({
    where: { course: { language: "ar" } },
  });
  const englishCerts = await db.certificate.count({
    where: { course: { language: "en" } },
  });

  console.log(`\n🌍 Certificates by language:`);
  console.log(`   Arabic:  ${arabicCerts}`);
  console.log(`   English: ${englishCerts}`);

  console.log("\n🎉 Session 3b test complete!\n");
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