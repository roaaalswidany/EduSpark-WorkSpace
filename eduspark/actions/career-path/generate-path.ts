// eduspark/actions/career-path/generate-path.ts
"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { CourseStatus } from "@prisma/client";
import { generateCareerPath } from "@/lib/ai/career-path-generator";

// ─── Validation ───────────────────────────────────────────────────

const GeneratePathSchema = z.object({
  goal: z
    .string()
    .min(5, "Please describe your goal in at least 5 characters.")
    .max(200, "Goal must be at most 200 characters.")
    .trim(),
  preferredLanguage: z.enum(["ar", "en"]).default("ar"),
});

export type GeneratePathInput = z.infer<typeof GeneratePathSchema>;

export type GeneratePathResult =
  | { success: true; pathId: string }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "INVALID_INPUT"
        | "GEMINI_NOT_CONFIGURED"
        | "RATE_LIMITED"
        | "NO_COURSES_AVAILABLE"
        | "AI_ERROR"
        | "SERVER_ERROR";
      fieldErrors?: Record<string, string[]>;
    };

// ─── Action ───────────────────────────────────────────────────────

export async function generateCareerPathAction(
  rawInput: GeneratePathInput
): Promise<GeneratePathResult> {
  try {
    // 1. Auth
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const userId = session.user.id;

    // 2. Validate input
    const parsed = GeneratePathSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "INVALID_INPUT",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<
          string,
          string[]
        >,
      };
    }

    const { goal, preferredLanguage } = parsed.data;

    // 3. Fetch user context + available courses in parallel
    const [user, enrollments, certificates, courses] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }),
      db.enrollment.findMany({
        where: { userId },
        select: {
          course: { select: { title: true, level: true } },
        },
      }),
      db.certificate.findMany({
        where: { userId },
        select: {
          course: { select: { title: true } },
        },
      }),
      db.course.findMany({
        where: { status: CourseStatus.PUBLISHED },
        select: {
          id: true,
          title: true,
          slug: true,
          level: true,
          tags: true,
        },
        take: 50, // limit for prompt size
      }),
    ]);

    if (!user) return { success: false, error: "UNAUTHORIZED" };

    // 4. Determine user's current level
    const hasCertificates = certificates.length > 0;
    const enrollmentsCount = enrollments.length;

    let currentLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" = "BEGINNER";
    if (hasCertificates && enrollmentsCount >= 5) currentLevel = "ADVANCED";
    else if (hasCertificates || enrollmentsCount >= 3)
      currentLevel = "INTERMEDIATE";

    // 5. Call AI generator
    const aiResult = await generateCareerPath(
      goal,
      {
        userName: user.name,
        currentLevel,
        existingCourses: enrollments.map((e) => ({
          title: e.course.title,
          level: e.course.level,
        })),
        existingCertificates: certificates.map((c) => ({
          courseTitle: c.course.title,
        })),
        preferredLanguage,
      },
      courses.map((c) => ({
        title: c.title,
        slug: c.slug,
        level: c.level,
        tags: c.tags,
      }))
    );

    if (!aiResult.success || !aiResult.data) {
      const errorMap: Record<string, GeneratePathResult & { success: false }> =
        {
          GEMINI_NOT_CONFIGURED: {
            success: false,
            error: "GEMINI_NOT_CONFIGURED",
          },
          RATE_LIMITED: { success: false, error: "RATE_LIMITED" },
          NO_COURSES_AVAILABLE: {
            success: false,
            error: "NO_COURSES_AVAILABLE",
          },
        };
      const known = aiResult.error
        ? errorMap[aiResult.error]
        : undefined;
      return known ?? { success: false, error: "AI_ERROR" };
    }

    const generated = aiResult.data;

    // 6. Map courseSlug → courseId
    const slugToId = new Map(courses.map((c) => [c.slug, c.id]));

    // 7. Save in transaction
    const result = await db.$transaction(async (tx) => {
      // Archive any existing ACTIVE path (user can only have one active)
      await tx.careerPath.updateMany({
        where: { userId, status: "ACTIVE" },
        data: { status: "ARCHIVED" },
      });

      // Create new path
      const path = await tx.careerPath.create({
        data: {
          userId,
          goal: generated.goal,
          level: generated.level,
          description: generated.description,
          estimatedWeeks: generated.estimatedWeeks,
          aiModel: "gemini-3.8-flash",
        },
        select: { id: true },
      });

      // Create all steps
      await tx.careerPathStep.createMany({
        data: generated.steps.map((step, idx) => ({
          pathId: path.id,
          order: idx + 1,
          title: step.title,
          description: step.description,
          courseId: step.courseSlug
            ? slugToId.get(step.courseSlug) ?? null
            : null,
          estimatedWeeks: step.estimatedWeeks,
          skills: step.skills,
        })),
      });

      return { pathId: path.id };
    });

    // 8. Revalidate
    revalidatePath("/dashboard/career-path");

    return { success: true, pathId: result.pathId };
  } catch (error) {
    console.error("[GENERATE_CAREER_PATH_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}