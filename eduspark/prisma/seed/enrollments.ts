// eduspark/prisma/seed/enrollments.ts
import {
  EnrollmentStatus,
  type Certificate,
  type Course,
  type Enrollment,
  type PrismaClient,
  type User,
} from "@prisma/client";
import {
  randomInt,
  randomFloat,
  daysAgo,
  generateCredentialId,
  generateProgress,
  logHeader,
  logSuccess,
  logInfo,
} from "./helpers";
import { SEED_COUNTS } from "./config";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SeededEnrollments {
  all: Enrollment[];
  certificates: Certificate[];
  stats: {
    total: number;
    active: number;
    completed: number;
    certificates: number;
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function seedEnrollments(
  db: PrismaClient,
  users: {
    student: User;
    students: User[];
    client: User;
  },
  courses: {
    all: Course[];
    withQuiz: Course[];
  }
): Promise<SeededEnrollments> {
  logHeader("🎓 Step 4: Enrollments + Certificates");

  // Cleanup: cascade covers LessonProgress, QuizAttempt, Certificate
  logInfo("Cleaning up existing enrollments...");
  await db.enrollment.deleteMany({});

  const allStudents = [users.student, ...users.students, users.client];
  const courseWithQuizIds = new Set(courses.withQuiz.map((c) => c.id));

  // ── Build unique enrollment pairs ─────────────────────────────
  const pairs = new Set<string>();
  const enrollmentSpecs: Array<{
    userId: string;
    courseId: string;
    progress: number;
  }> = [];

  let attempts = 0;
  const MAX_ATTEMPTS = SEED_COUNTS.enrollments * 10;

  while (enrollmentSpecs.length < SEED_COUNTS.enrollments && attempts < MAX_ATTEMPTS) {
    attempts++;
    const user = allStudents[randomInt(0, allStudents.length - 1)];
    const course = courses.all[randomInt(0, courses.all.length - 1)];
    const key = `${user.id}:${course.id}`;

    if (pairs.has(key)) continue;
    pairs.add(key);

    enrollmentSpecs.push({
      userId: user.id,
      courseId: course.id,
      progress: generateProgress(),
    });
  }

  logInfo(`Generated ${enrollmentSpecs.length} unique enrollments`);

  // ── Create enrollments in batches ─────────────────────────────
  const createdEnrollments: Enrollment[] = [];
  const createdCertificates: Certificate[] = [];

  let completedCount = 0;
  let activeCount = 0;

  for (let i = 0; i < enrollmentSpecs.length; i++) {
    const spec = enrollmentSpecs[i];
    const course = courses.all.find((c) => c.id === spec.courseId)!;
    const courseHasQuiz = courseWithQuizIds.has(course.id);

    const isFullyCompleted = spec.progress === 100;
    const isPassed = isFullyCompleted && courseHasQuiz;

    // ── Create enrollment ────────────────────────────────────────
    const enrollment = await db.enrollment.create({
      data: {
        userId: spec.userId,
        courseId: spec.courseId,
        paidAmount: course.price,
        progress: spec.progress,
        status: isFullyCompleted
          ? EnrollmentStatus.COMPLETED
          : EnrollmentStatus.ACTIVE,
        isPassed,
        completedAt: isFullyCompleted ? daysAgo(randomInt(1, 90)) : null,
        createdAt: daysAgo(randomInt(10, 200)),
      },
    });

    createdEnrollments.push(enrollment);

    if (isFullyCompleted) completedCount++;
    else activeCount++;

    // ── LessonProgress ───────────────────────────────────────────
    const lessons = await db.lesson.findMany({
      where: { section: { courseId: course.id } },
      select: { id: true },
    });

    const completedLessons = Math.round((spec.progress / 100) * lessons.length);

    if (completedLessons > 0 && lessons.length > 0) {
      const progressData = lessons
        .slice(0, completedLessons)
        .map((lesson) => ({
          enrollmentId: enrollment.id,
          lessonId: lesson.id,
          completed: true,
          watchedAt: daysAgo(randomInt(1, 100)),
        }));

      await db.lessonProgress.createMany({ data: progressData });
    }

    // ── QuizAttempt + Certificate ────────────────────────────────
    if (isPassed) {
      const quiz = await db.quiz.findUnique({
        where: { courseId: course.id },
        include: { questions: true },
      });

      if (quiz) {
        const totalQ = quiz.questions.length;
        const correctQ = totalQ; // full pass
        const score = randomFloat(85, 100);

        const attempt = await db.quizAttempt.create({
          data: {
            userId: spec.userId,
            quizId: quiz.id,
            courseId: course.id,
            score,
            passed: true,
            totalQ,
            correctQ,
            submittedAt: daysAgo(randomInt(1, 80)),
          },
        });

        const certificate = await db.certificate.create({
          data: {
            userId: spec.userId,
            courseId: course.id,
            attemptId: attempt.id,
            score,
            credentialId: generateCredentialId(),
            issuedAt: daysAgo(randomInt(1, 80)),
          },
        });

        createdCertificates.push(certificate);
      }
    }

    if ((i + 1) % 50 === 0) {
      logInfo(`  Progress: ${i + 1}/${enrollmentSpecs.length}`);
    }
  }

  logSuccess(`${createdEnrollments.length} enrollments created`);
  logInfo(`  ✅ Completed: ${completedCount}`);
  logInfo(`  🔄 Active:    ${activeCount}`);
  logInfo(`  🏆 Certificates: ${createdCertificates.length}`);

  return {
    all: createdEnrollments,
    certificates: createdCertificates,
    stats: {
      total: createdEnrollments.length,
      active: activeCount,
      completed: completedCount,
      certificates: createdCertificates.length,
    },
  };
}