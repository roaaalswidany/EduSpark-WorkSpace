// eduspark/prisma/seed/certificate-booster.ts
import {
  EnrollmentStatus,
  type Course,
  type PrismaClient,
} from "@prisma/client";
import {
  generateCredentialId,
  randomFloat,
  randomInt,
  daysAgo,
  logHeader,
  logSuccess,
  logInfo,
} from "./helpers";

// ─── Booster Plan ────────────────────────────────────────────────────────────
// Guarantees each demo/test account has at least N certificates.
// Protected accounts (roaaswidany@gmail.com) are ONLY augmented — never deleted.

const BOOSTER_PLAN: Record<string, number> = {
  "sarah.creator@eduspark.dev": 3,
  "ahmad.student@eduspark.dev": 5,
  "layla.client@eduspark.dev": 2,
  "admin@eduspark.dev": 4,
  "roaaswidany@gmail.com": 4, // real admin — only add, never delete
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BoosterResult {
  totalAdded: number;
  perUser: Record<string, { name: string; existing: number; added: number; final: number }>;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function boostCertificates(
  db: PrismaClient,
  courses: { withQuiz: Course[] }
): Promise<BoosterResult> {
  logHeader("🏆 Step 5: Certificate Booster");

  if (courses.withQuiz.length === 0) {
    throw new Error("No courses with quiz found — seed courses first.");
  }

  const perUser: BoosterResult["perUser"] = {};
  let totalAdded = 0;

  for (const [email, targetCount] of Object.entries(BOOSTER_PLAN)) {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      logInfo(`  [skip] ${email} — not found`);
      continue;
    }

    // Count existing certificates
    const existing = await db.certificate.count({
      where: { userId: user.id },
    });

    const needed = Math.max(0, targetCount - existing);

    if (needed === 0) {
      logInfo(`  [ok]   ${user.name} already has ${existing} certificates`);
      perUser[email] = {
        name: user.name,
        existing,
        added: 0,
        final: existing,
      };
      continue;
    }

    // Find courses (with quiz) the user is NOT enrolled in
    const enrolledCourseIds = (
      await db.enrollment.findMany({
        where: { userId: user.id },
        select: { courseId: true },
      })
    ).map((e) => e.courseId);

    const availableCourses = courses.withQuiz.filter(
      (c) => !enrolledCourseIds.includes(c.id)
    );

    if (availableCourses.length < needed) {
      logInfo(
        `  [warn] ${user.name}: only ${availableCourses.length} courses available, needed ${needed}`
      );
    }

    const toUse = availableCourses.slice(0, needed);
    let added = 0;

    for (const course of toUse) {
      const quiz = await db.quiz.findUnique({
        where: { courseId: course.id },
        include: { questions: true },
      });
      if (!quiz) continue;

      const score = randomFloat(85, 100);
      const submittedAt = daysAgo(randomInt(5, 90));
      const issuedAt = daysAgo(randomInt(1, 60));

      // Create enrollment (fully completed)
      const enrollment = await db.enrollment.create({
        data: {
          userId: user.id,
          courseId: course.id,
          paidAmount: course.price,
          progress: 100,
          status: EnrollmentStatus.COMPLETED,
          isPassed: true,
          completedAt: submittedAt,
          createdAt: daysAgo(randomInt(60, 200)),
        },
      });

      // Create quiz attempt
      const attempt = await db.quizAttempt.create({
        data: {
          userId: user.id,
          quizId: quiz.id,
          courseId: course.id,
          score,
          passed: true,
          totalQ: quiz.questions.length,
          correctQ: quiz.questions.length,
          submittedAt,
        },
      });

      // Create certificate
      await db.certificate.create({
        data: {
          userId: user.id,
          courseId: course.id,
          attemptId: attempt.id,
          score,
          credentialId: generateCredentialId(),
          issuedAt,
        },
      });

      // Complete all lessons
      const lessons = await db.lesson.findMany({
        where: { section: { courseId: course.id } },
        select: { id: true },
      });

      if (lessons.length > 0) {
        await db.lessonProgress.createMany({
          data: lessons.map((l) => ({
            enrollmentId: enrollment.id,
            lessonId: l.id,
            completed: true,
            watchedAt: daysAgo(randomInt(1, 150)),
          })),
          skipDuplicates: true,
        });
      }

      added++;
      totalAdded++;
    }

    perUser[email] = {
      name: user.name,
      existing,
      added,
      final: existing + added,
    };

    logSuccess(`${user.name}: +${added} certificates (total: ${existing + added})`);
  }

  logSuccess(`Booster added ${totalAdded} certificates total`);

  return { totalAdded, perUser };
}