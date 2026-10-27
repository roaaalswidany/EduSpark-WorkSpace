import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

let seq = 0;
const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Wipe all app tables between test files (CASCADE keeps FK order trivial). */
export async function resetDatabase() {
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (!rows.length) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function createUser(role: Role = "STUDENT", extra: Record<string, unknown> = {}) {
  const id = uid();
  return db.user.create({
    data: { name: `User ${id}`, email: `${id}@test.local`, role, ...extra },
  });
}

export async function createCategory(name = `Cat-${uid()}`) {
  return db.category.create({ data: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") } });
}

/**
 * Published course with 1 section, N lessons and a quiz of M questions whose
 * correct answer is always "A" (options A-D).
 */
export async function createCourseWithQuiz(opts: {
  creatorId: string;
  lessons?: number;
  questions?: number;
  passingScore?: number;
  categoryId?: string;
}) {
  const { creatorId, lessons = 2, questions = 4, passingScore = 75, categoryId } = opts;
  const slug = `course-${uid()}`;
  const course = await db.course.create({
    data: {
      title: `Course ${slug}`, slug, description: "Test course", price: 10,
      status: "PUBLISHED", creatorId, ...(categoryId ? { categoryId } : {}),
      sections: {
        create: {
          title: "S1", order: 1,
          lessons: { create: Array.from({ length: lessons }, (_, i) => ({ title: `L${i + 1}`, order: i + 1 })) },
        },
      },
      quiz: {
        create: {
          title: "Quiz", passingScore,
          questions: {
            create: Array.from({ length: questions }, (_, i) => ({
              text: `Q${i + 1}?`, order: i + 1, correctOption: "A",
              options: [{ id: "A", text: "a" }, { id: "B", text: "b" }, { id: "C", text: "c" }, { id: "D", text: "d" }],
            })),
          },
        },
      },
    },
    include: { quiz: { include: { questions: { orderBy: { order: "asc" } } } }, sections: { include: { lessons: true } } },
  });
  return course;
}

export async function enroll(userId: string, courseId: string) {
  return db.enrollment.create({ data: { userId, courseId, paidAmount: 0 } });
}
