// eduspark/prisma/seed/test-session-3a.ts
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedCourses } from "./courses";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

async function main(): Promise<void> {
  console.log("\n🧪 Session 3a Test Runner\n");

  const instructor = await db.user.findUniqueOrThrow({
    where: { email: "sarah.creator@eduspark.dev" },
  });
  const creators = await db.user.findMany({
    where: { role: "CREATOR", email: { not: "sarah.creator@eduspark.dev" } },
    take: 20,
  });
  const categories = await db.category.findMany();

  if (creators.length === 0 || categories.length === 0) {
    throw new Error(
      "Missing prerequisites: run Session 2 test first (users + categories)."
    );
  }

  const courses = await seedCourses(db, { creators, instructor }, categories);

  console.log(`\n📊 Courses summary:`);
  console.log(`   Total: ${courses.all.length}`);
  console.log(`   Arabic: ${courses.arabic.length}`);
  console.log(`   English: ${courses.english.length}`);
  console.log(`   With quiz: ${courses.withQuiz.length}`);

  console.log(`\n🔍 Sample courses:`);
  [0, 7, 14, 15, 22, 29].forEach((i) => {
    const c = courses.all[i];
    if (c) console.log(`   [${i}] ${c.title} (${c.language}, ${c.level})`);
  });

  const courseWithMost = await db.course.findFirstOrThrow({
    where: { id: courses.all[0].id },
    include: {
      sections: { include: { lessons: true } },
      quiz: { include: { questions: true } },
    },
  });

  console.log(`\n📖 Course structure check (${courseWithMost.title}):`);
  console.log(`   Sections: ${courseWithMost.sections.length}`);
  courseWithMost.sections.forEach((s) => {
    console.log(`     - ${s.title} (${s.lessons.length} lessons)`);
  });
  if (courseWithMost.quiz) {
    console.log(`   Quiz: ${courseWithMost.quiz.questions.length} questions`);
  }

  const totalSections = await db.section.count();
  const totalLessons = await db.lesson.count();
  const totalQuizzes = await db.quiz.count();
  const totalQuestions = await db.question.count();

  console.log(`\n📈 Totals in DB:`);
  console.log(`   Sections: ${totalSections}`);
  console.log(`   Lessons: ${totalLessons}`);
  console.log(`   Quizzes: ${totalQuizzes}`);
  console.log(`   Questions: ${totalQuestions}`);

  console.log("\n🎉 Session 3a test complete!\n");
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