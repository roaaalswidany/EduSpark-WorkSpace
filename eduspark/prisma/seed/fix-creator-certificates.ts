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

function generateCredentialId(prefix = "EDU"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${code}`;
}

async function main() {
  console.log("\n🔧 Fixing creator certificates...\n");

  // Get all services with creator + category
  const services = await db.service.findMany({
    where: { status: { not: "ARCHIVED" } },
    select: {
      id: true,
      title: true,
      categoryId: true,
      creatorId: true,
      creator: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  console.log(`Found ${services.length} active services\n`);

  // Group services by creator
  const byCreator = new Map<
    string,
    {
      name: string;
      role: string;
      categoryIds: Set<string>;
    }
  >();

  for (const s of services) {
    if (!s.categoryId) continue;
    if (s.creator.role === "ADMIN") continue;

    if (!byCreator.has(s.creatorId)) {
      byCreator.set(s.creatorId, {
        name: s.creator.name,
        role: s.creator.role,
        categoryIds: new Set(),
      });
    }
    byCreator.get(s.creatorId)!.categoryIds.add(s.categoryId);
  }

  console.log(`Found ${byCreator.size} creators to process\n`);

  let certificatesIssued = 0;
  let creatorsFixed = 0;

  for (const [creatorId, data] of byCreator) {
    // Get existing certificate category IDs
    const existingCerts = await db.certificate.findMany({
      where: { userId: creatorId },
      select: { course: { select: { categoryId: true } } },
    });
    const existingCategoryIds = new Set(
      existingCerts.map((c) => c.course.categoryId).filter(Boolean) as string[]
    );

    // Find missing categories
    const missingCategories = [...data.categoryIds].filter(
      (c) => !existingCategoryIds.has(c)
    );

    if (missingCategories.length === 0) continue;

    creatorsFixed++;
    console.log(`👤 ${data.name} (${data.role})`);
    console.log(`   Missing certificates for ${missingCategories.length} categories`);

    for (const categoryId of missingCategories) {
      // Find a published course in this category
      const course = await db.course.findFirst({
        where: {
          categoryId,
          status: "PUBLISHED",
        },
        select: {
          id: true,
          title: true,
        },
      });

      if (!course) {
        console.log(`   ⚠️  No course found in category ${categoryId}`);
        continue;
      }

      // Check if user already has a certificate for this course
      const existing = await db.certificate.findUnique({
        where: {
          userId_courseId: { userId: creatorId, courseId: course.id },
        },
      });

      if (existing) {
        console.log(`   ✓ Already has cert: ${course.title}`);
        continue;
      }

      // Get quiz for the course (needed for attempt)
      const quiz = await db.quiz.findUnique({
        where: { courseId: course.id },
        select: { id: true, questions: { select: { id: true } } },
      });

      if (!quiz) {
        console.log(`   ⚠️  No quiz for course: ${course.title}`);
        continue;
      }

      // Create quiz attempt
      const attempt = await db.quizAttempt.create({
        data: {
          userId: creatorId,
          quizId: quiz.id,
          courseId: course.id,
          score: 100,
          passed: true,
          totalQ: quiz.questions.length,
          correctQ: quiz.questions.length,
        },
      });

      // Create certificate
      await db.certificate.create({
        data: {
          userId: creatorId,
          courseId: course.id,
          attemptId: attempt.id,
          score: 100,
          credentialId: generateCredentialId(),
        },
      });

      // Also ensure enrollment exists (COMPLETED)
      const existingEnrollment = await db.enrollment.findUnique({
        where: {
          userId_courseId: { userId: creatorId, courseId: course.id },
        },
      });

      if (!existingEnrollment) {
        await db.enrollment.create({
          data: {
            userId: creatorId,
            courseId: course.id,
            paidAmount: 0,
            progress: 100,
            isPassed: true,
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });
      }

      certificatesIssued++;
      console.log(`   ✅ Issued cert for: ${course.title.slice(0, 50)}`);
    }
    console.log("");
  }

  // Also: ensure any CREATOR without any certificate gets one
  const creatorsWithoutCerts = await db.user.findMany({
    where: {
      role: "CREATOR",
      certificates: { none: {} },
      services: { none: {} }, // only those without any service
    },
    select: { id: true, name: true },
  });

  console.log(`\n📊 Summary:`);
  console.log(`   Creators fixed: ${creatorsFixed}`);
  console.log(`   Certificates issued: ${certificatesIssued}`);
  console.log(`   Creators with 0 services + 0 certs: ${creatorsWithoutCerts.length}`);
  console.log("");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });