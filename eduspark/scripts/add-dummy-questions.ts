import * as dotenv from "dotenv";
import path from "path";

// Load .env.local explicitly (Next.js does this automatically, tsx doesn't)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("add-dummy-questions is a development helper and must not run in production.");
  }
  // Dynamic import ensures lib/db is loaded AFTER dotenv has populated process.env
  const { db: prisma } = await import("../lib/db");

  // 1. البحث عن أول كورس متاح
  const course = await prisma.course.findFirst({
    where: { title: { contains: "Prisma" } },
  });

  if (!course) {
    console.error("❌ No course found! Please create a course first.");
    return;
  }

  console.log(`✅ Found course: "${course.title}" (ID: ${course.id})`);

  // 2. جلب أو إنشاء الكويز
  let quiz = await prisma.quiz.findUnique({
    where: { courseId: course.id },
  });

  if (!quiz) {
    quiz = await prisma.quiz.create({
      data: {
        title: `${course.title} — Certification Quiz`,
        courseId: course.id,
      },
    });
    console.log(`✅ Created new quiz for the course.`);
  } else {
    console.log(`✅ Found existing quiz.`);
  }

  // 3. إضافة 5 أسئلة
  console.log(`⏳ Adding 5 dummy questions...`);

  for (let i = 1; i <= 5; i++) {
    await prisma.question.create({
      data: {
        quizId: quiz.id,
        text: `Test Question ${i}: What is Prisma?`,
        options: [
          "A database ORM",
          "A frontend framework",
          "A CSS library",
          "A testing tool",
        ],
        correctOption: "A database ORM",
        explanation:
          "Prisma is an ORM for Node.js and TypeScript that helps developers build faster and make fewer errors.",
        order: i,
        status: "PUBLISHED",
        generatedBy: "MANUAL",
      },
    });
  }

  console.log(`🎉 Successfully added 5 questions to the quiz!`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});