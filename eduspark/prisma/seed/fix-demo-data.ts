/* eslint-disable @typescript-eslint/no-unused-vars */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

async function main() {
  console.log("\n🔧 Fixing demo data...\n");

  // ═══════════════════════════════════════════════════════════
  // STEP 1: Add quizzes to courses WITHOUT one
  // ═══════════════════════════════════════════════════════════
  console.log("📚 Step 1: Adding quizzes to courses without one\n");

  const coursesWithoutQuiz = await db.course.findMany({
    where: { quiz: null },
    select: { id: true, title: true, language: true },
  });

  console.log(`Found ${coursesWithoutQuiz.length} courses without quiz\n`);

  for (const course of coursesWithoutQuiz) {
    const isArabic = /[\u0600-\u06FF]/.test(course.title);

    const quiz = await db.quiz.create({
      data: {
        title: isArabic
          ? `اختبار ${course.title}`
          : `${course.title} — Certification Quiz`,
        description: isArabic
          ? "اختبار يغطي المفاهيم الأساسية في الدورة."
          : "Quiz covering the core concepts of the course.",
        passingScore: 80,
        timeLimit: 600,
        courseId: course.id,
        questions: {
          create: [
            {
              text: isArabic
                ? `هل أكملت جميع دروس "${course.title}"؟`
                : `Have you completed all lessons in "${course.title}"?`,
              options: isArabic
                ? ["نعم", "لا", "جزئياً", "لم أبدأ"]
                : ["Yes", "No", "Partially", "Not yet"],
              correctOption: isArabic ? "نعم" : "Yes",
              explanation: isArabic
                ? "إكمال جميع الدروس شرط للحصول على الشهادة."
                : "Completing all lessons is required for certification.",
              order: 1,
              status: "PUBLISHED",
            },
            {
              text: isArabic
                ? "هل فهمت المفاهيم الأساسية في هذه الدورة؟"
                : "Did you understand the core concepts of this course?",
              options: isArabic
                ? ["نعم", "لا", "جزئياً", "لم أبدأ"]
                : ["Yes", "No", "Partially", "Not yet"],
              correctOption: isArabic ? "نعم" : "Yes",
              explanation: isArabic
                ? "الفهم الأساسي مطلوب للتطبيق العملي."
                : "Core understanding is required for practical application.",
              order: 2,
              status: "PUBLISHED",
            },
            {
              text: isArabic
                ? "هل أنت مستعد لتطبيق ما تعلمته في مشروع حقيقي؟"
                : "Are you ready to apply what you learned in a real project?",
              options: isArabic
                ? ["نعم", "لا", "جزئياً", "لم أبدأ"]
                : ["Yes", "No", "Partially", "Not yet"],
              correctOption: isArabic ? "نعم" : "Yes",
              explanation: isArabic
                ? "التطبيق العملي هو الهدف النهائي."
                : "Practical application is the ultimate goal.",
              order: 3,
              status: "PUBLISHED",
            },
          ],
        },
      },
    });

        console.log(`  ✅ Added quiz: ${course.title.slice(0, 50)} (3 questions)`);
  }

  console.log("\n");

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Add courses to categories WITHOUT any
  // ═══════════════════════════════════════════════════════════
  console.log("📂 Step 2: Adding courses to empty categories\n");

  const allCategories = await db.category.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      courses: { select: { id: true } },
    },
  });

  const emptyCategories = allCategories.filter(
    (c) => c.courses.length === 0
  );

  console.log(`Found ${emptyCategories.length} empty categories\n`);

  const instructor = await db.user.findFirst({
    where: { email: "sarah.creator@eduspark.dev" },
    select: { id: true },
  });

  if (!instructor) {
    throw new Error("Instructor Sarah not found");
  }

  for (const category of emptyCategories) {
    const isArabic = /[\u0600-\u06FF]/.test(category.name);

    const title = isArabic
      ? `مقدمة في ${category.name}`
      : `Introduction to ${category.name}`;

    const slug = `${category.slug}-intro-${Date.now().toString().slice(-4)}`;

    const course = await db.course.create({
      data: {
        title,
        slug,
        description: isArabic
          ? `دورة تمهيدية شاملة في مجال ${category.name}. تعلم الأساسيات وأفضل الممارسات.`
          : `A comprehensive introductory course in ${category.name}. Learn the fundamentals and best practices.`,
        price: 39.99,
        level: "BEGINNER",
        status: "PUBLISHED",
        language: isArabic ? "ar" : "en",
        tags: [category.slug, "introduction"],
        totalRating: 4.5,
        ratingCount: 10,
        creatorId: instructor.id,
        categoryId: category.id,
        sections: {
          create: [
            {
              title: isArabic ? "البداية" : "Getting Started",
              order: 1,
              lessons: {
                create: [
                  {
                    title: isArabic
                      ? `مقدمة عن ${category.name}`
                      : `Introduction to ${category.name}`,
                    description: isArabic
                      ? "نظرة عامة على المجال وأهميته."
                      : "Overview of the field and its importance.",
                    videoUrl:
                      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    duration: 420,
                    order: 1,
                    isFree: true,
                  },
                  {
                    title: isArabic ? "المفاهيم الأساسية" : "Core Concepts",
                    description: isArabic
                      ? "المفاهيم التي يجب أن تعرفها."
                      : "The concepts you need to know.",
                    videoUrl:
                      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    duration: 600,
                    order: 2,
                    isFree: false,
                  },
                ],
              },
            },
          ],
        },
      },
    });

    // Add quiz to this course
    await db.quiz.create({
      data: {
        title: isArabic
          ? `اختبار ${title}`
          : `${title} — Certification Quiz`,
        description: isArabic
          ? "اختبار أساسي للتحقق من الفهم."
          : "Basic quiz to verify understanding.",
        passingScore: 80,
        timeLimit: 600,
        courseId: course.id,
        questions: {
          create: [
            {
              text: isArabic
                ? `ما هو الهدف الأساسي من "${title}"؟`
                : `What is the main goal of "${title}"?`,
              options: isArabic
                ? ["التعلم والتمكن", "الحفظ فقط", "التسلية", "لا شيء"]
                : ["Learn & master", "Memorize only", "Entertainment", "Nothing"],
              correctOption: isArabic ? "التعلم والتمكن" : "Learn & master",
              explanation: isArabic
                ? "الهدف هو التمكن الحقيقي من المهارة."
                : "The goal is true skill mastery.",
              order: 1,
              status: "PUBLISHED",
            },
            {
              text: isArabic
                ? "متى تكون مستعداً لشهادة؟"
                : "When are you ready for certification?",
              options: isArabic
                ? ["بعد إكمال الدروس", "بعد يوم", "لا يمكن", "بعد سنة"]
                : [
                    "After completing lessons",
                    "After one day",
                    "Never",
                    "After a year",
                  ],
              correctOption: isArabic
                ? "بعد إكمال الدروس"
                : "After completing lessons",
              explanation: isArabic
                ? "إكمال الدروس شرط أساسي."
                : "Completing lessons is a prerequisite.",
              order: 2,
              status: "PUBLISHED",
            },
            {
              text: isArabic
                ? "ما الفائدة من الشهادة؟"
                : "What is the benefit of the certificate?",
              options: isArabic
                ? [
                    "تفتح فرص العمل الحر",
                    "زينة فقط",
                    "لا فائدة",
                    "تعقيد الأمور",
                  ]
                : [
                    "Opens freelancing opportunities",
                    "Just decoration",
                    "No benefit",
                    "Complicates things",
                  ],
              correctOption: isArabic
                ? "تفتح فرص العمل الحر"
                : "Opens freelancing opportunities",
              explanation: isArabic
                ? "الشهادة تؤهلك لتصبح منشئ خدمات معتمد."
                : "The certificate qualifies you as a certified creator.",
              order: 3,
              status: "PUBLISHED",
            },
          ],
        },
      },
    });

    console.log(`  ✅ Created course: ${title}`);
    console.log(`     Category: ${category.name}`);
  }

  console.log("");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Quizzes added: ${coursesWithoutQuiz.length}`);
  console.log(`  Courses created: ${emptyCategories.length}`);
  console.log("═══════════════════════════════════════════════");
  console.log("\n✅ Demo data fixed. Next: re-run fix-creator-certificates.ts\n");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });