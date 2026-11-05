"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getFreshUser } from "@/lib/security/fresh-user";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

// ─── Helper: Check Creator ──────────────────────────────────────
async function requireCreator(): Promise<{
  id: string;
  role: Role;
}> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("UNAUTHORIZED");
  const user = await getFreshUser(session.user.id);
  if (!user?.isActive) throw new Error("UNAUTHORIZED");
  if (user.role !== Role.CREATOR && user.role !== Role.ADMIN) {
    throw new Error("FORBIDDEN");
  }
  return { id: session.user.id, role: user.role };
}

async function requireCourseOwner(courseId: string, userId: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, creatorId: true, slug: true, status: true },
  });
  if (!course) throw new Error("NOT_FOUND");
  if (course.creatorId !== userId) throw new Error("FORBIDDEN");
  // What the reviewer is looking at must not change under their feet.
  if (course.status === "PENDING_REVIEW") throw new Error("COURSE_LOCKED");
  return course;
}

// ─── Sections ──────────────────────────────────────────────────

const SectionInput = z.object({
  courseId: z.string().cuid(),
  title: z.string().min(2, "Title too short").max(200),
});

export type SectionResult =
  | { success: true; sectionId: string }
  | { success: false; error: string };

export async function createSectionAction(
  raw: z.infer<typeof SectionInput>
): Promise<SectionResult> {
  try {
    const user = await requireCreator();
    const { courseId, title } = SectionInput.parse(raw);
    await requireCourseOwner(courseId, user.id);

    const count = await db.section.count({ where: { courseId } });
    const section = await db.section.create({
      data: { title, order: count + 1, courseId },
      select: { id: true },
    });

    revalidatePath(`/dashboard/creator/courses/${courseId}/edit`);
    return { success: true, sectionId: section.id };
  } catch (e) {
    console.error("[CREATE_SECTION]", e);
    return { success: false, error: e instanceof Error ? e.message : "SERVER_ERROR" };
  }
}

const UpdateSectionInput = z.object({
  sectionId: z.string().cuid(),
  title: z.string().min(2).max(200).optional(),
  order: z.number().int().min(1).optional(),
});

export async function updateSectionAction(
  raw: z.infer<typeof UpdateSectionInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireCreator();
    const { sectionId, title, order } = UpdateSectionInput.parse(raw);

    const existing = await db.section.findUnique({
      where: { id: sectionId },
      select: { courseId: true, course: { select: { creatorId: true, status: true } } },
    });
    if (!existing) return { success: false, error: "NOT_FOUND" };
    if (existing.course.creatorId !== user.id) return { success: false, error: "FORBIDDEN" };
    if (existing.course.status === "PENDING_REVIEW") return { success: false, error: "COURSE_LOCKED" };

    await db.section.update({
      where: { id: sectionId },
      data: {
        ...(title !== undefined && { title }),
        ...(order !== undefined && { order }),
      },
    });

    revalidatePath(`/dashboard/creator/courses/${existing.courseId}/edit`);
    return { success: true };
  } catch (e) {
    console.error("[UPDATE_SECTION]", e);
    return { success: false, error: e instanceof Error ? e.message : "SERVER_ERROR" };
  }
}

export async function deleteSectionAction(sectionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireCreator();

    const existing = await db.section.findUnique({
      where: { id: sectionId },
      select: { courseId: true, course: { select: { creatorId: true, status: true } } },
    });
    if (!existing) return { success: false, error: "NOT_FOUND" };
    if (existing.course.creatorId !== user.id) return { success: false, error: "FORBIDDEN" };
    if (existing.course.status === "PENDING_REVIEW") return { success: false, error: "COURSE_LOCKED" };

    await db.section.delete({ where: { id: sectionId } });

    revalidatePath(`/dashboard/creator/courses/${existing.courseId}/edit`);
    return { success: true };
  } catch (e) {
    console.error("[DELETE_SECTION]", e);
    return { success: false, error: e instanceof Error ? e.message : "SERVER_ERROR" };
  }
}

// ─── Lessons ───────────────────────────────────────────────────

const LessonInput = z.object({
  sectionId: z.string().cuid(),
  title: z.string().min(2, "Title too short").max(200),
  description: z.string().max(2000).optional(),
  videoUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  duration: z.number().int().min(0).max(100000).optional(),
  isFree: z.boolean().optional(),
});

export type LessonResult =
  | { success: true; lessonId: string }
  | { success: false; error: string };

export async function createLessonAction(
  raw: z.infer<typeof LessonInput>
): Promise<LessonResult> {
  try {
    const user = await requireCreator();
    const data = LessonInput.parse(raw);

    const section = await db.section.findUnique({
      where: { id: data.sectionId },
      select: { courseId: true, course: { select: { creatorId: true, status: true } } },
    });
    if (!section) return { success: false, error: "NOT_FOUND" };
    if (section.course.creatorId !== user.id) return { success: false, error: "FORBIDDEN" };
    if (section.course.status === "PENDING_REVIEW") return { success: false, error: "COURSE_LOCKED" };

    const count = await db.lesson.count({ where: { sectionId: data.sectionId } });
    const lesson = await db.lesson.create({
      data: {
        sectionId: data.sectionId,
        title: data.title,
        description: data.description || null,
        videoUrl: data.videoUrl || null,
        duration: data.duration ?? null,
        isFree: data.isFree ?? false,
        order: count + 1,
      },
      select: { id: true },
    });

    revalidatePath(`/dashboard/creator/courses/${section.courseId}/edit`);
    return { success: true, lessonId: lesson.id };
  } catch (e) {
    console.error("[CREATE_LESSON]", e);
    return { success: false, error: e instanceof Error ? e.message : "SERVER_ERROR" };
  }
}

const UpdateLessonInput = LessonInput.partial().extend({
  lessonId: z.string().cuid(),
});

export async function updateLessonAction(
  raw: z.infer<typeof UpdateLessonInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireCreator();
    const { lessonId, ...data } = UpdateLessonInput.parse(raw);

    const existing = await db.lesson.findUnique({
      where: { id: lessonId },
      select: {
        sectionId: true,
        section: { select: { courseId: true, course: { select: { creatorId: true, status: true } } } },
      },
    });
    if (!existing) return { success: false, error: "NOT_FOUND" };
    if (existing.section.course.creatorId !== user.id) return { success: false, error: "FORBIDDEN" };
    if (existing.section.course.status === "PENDING_REVIEW") return { success: false, error: "COURSE_LOCKED" };

    await db.lesson.update({
      where: { id: lessonId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl || null }),
        ...(data.duration !== undefined && { duration: data.duration }),
        ...(data.isFree !== undefined && { isFree: data.isFree }),
      },
    });

    revalidatePath(`/dashboard/creator/courses/${existing.section.courseId}/edit`);
    return { success: true };
  } catch (e) {
    console.error("[UPDATE_LESSON]", e);
    return { success: false, error: e instanceof Error ? e.message : "SERVER_ERROR" };
  }
}

export async function deleteLessonAction(lessonId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireCreator();

    const existing = await db.lesson.findUnique({
      where: { id: lessonId },
      select: {
        sectionId: true,
        section: { select: { courseId: true, course: { select: { creatorId: true, status: true } } } },
      },
    });
    if (!existing) return { success: false, error: "NOT_FOUND" };
    if (existing.section.course.creatorId !== user.id) return { success: false, error: "FORBIDDEN" };
    if (existing.section.course.status === "PENDING_REVIEW") return { success: false, error: "COURSE_LOCKED" };

    await db.lesson.delete({ where: { id: lessonId } });

    revalidatePath(`/dashboard/creator/courses/${existing.section.courseId}/edit`);
    return { success: true };
  } catch (e) {
    console.error("[DELETE_LESSON]", e);
    return { success: false, error: e instanceof Error ? e.message : "SERVER_ERROR" };
  }
}