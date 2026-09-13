"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/app/lib/db";
import type { CourseLevel, EnrollmentStatus } from "@prisma/client";

// ─── Public Types (consumed by client components) ────────────────────────────

export interface LessonData {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  duration: number | null;
  order: number;
  isFree: boolean;
  isCompleted: boolean;
  watchedAt: Date | null;
}

export interface SectionData {
  id: string;
  title: string;
  order: number;
  lessons: LessonData[];
  completedCount: number;
  totalCount: number;
}

export interface EnrollmentInfo {
  id: string;
  progress: number;
  status: EnrollmentStatus;
  isPassed: boolean;
  completedAt: Date | null;
  createdAt: Date;
}

export interface CourseData {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail: string | null;
  level: CourseLevel;
  language: string;
  creator: {
    id: string;
    name: string;
    image: string | null;
    headline: string | null;
  };
  sections: SectionData[];
  enrollment: EnrollmentInfo | null;
  totalLessons: number;
  completedLessons: number;
  firstUncompletedLessonId: string | null;
}

export type GetCourseResult =
  | { success: true; data: CourseData }
  | {
      success: false;
      error: "UNAUTHORIZED" | "NOT_ENROLLED" | "NOT_FOUND" | "SERVER_ERROR";
    };

// ─── Action ───────────────────────────────────────────────────────────────────

export async function getCourseAction(
  courseId: string
): Promise<GetCourseResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const { id: userId, role } = session.user;

    // Single parallel round-trip: course structure + user enrollment
    const [course, enrollment] = await Promise.all([
      db.course.findUnique({
        where: { id: courseId },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          thumbnail: true,
          level: true,
          language: true,
          creatorId: true,
          creator: {
            select: {
              id: true,
              name: true,
              image: true,
              headline: true,
            },
          },
          sections: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              order: true,
              lessons: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  title: true,
                  description: true,
                  videoUrl: true,
                  duration: true,
                  order: true,
                  isFree: true,
                },
              },
            },
          },
        },
      }),
      db.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: {
          id: true,
          progress: true,
          status: true,
          isPassed: true,
          completedAt: true,
          createdAt: true,
          lessonProgress: {
            where: { completed: true },
            select: { lessonId: true, watchedAt: true },
          },
        },
      }),
    ]);

    if (!course) return { success: false, error: "NOT_FOUND" };

    // Access control: enrolled students, course owner (CREATOR), or ADMIN
    const isOwner = role === "CREATOR" && course.creatorId === userId;
    const isAdmin = role === "ADMIN";
    const isEnrolled = enrollment !== null;

    if (!isEnrolled && !isOwner && !isAdmin) {
      return { success: false, error: "NOT_ENROLLED" };
    }

    // Build O(1) completion lookup map
    const completedMap = new Map<string, Date | null>(
      (enrollment?.lessonProgress ?? []).map((lp) => [
        lp.lessonId,
        lp.watchedAt,
      ])
    );

    let totalLessons = 0;
    let completedLessons = 0;
    let firstUncompletedLessonId: string | null = null;

    const sections: SectionData[] = course.sections.map((section) => {
      const lessons: LessonData[] = section.lessons.map((lesson) => {
        totalLessons++;

        const isCompleted = completedMap.has(lesson.id);
        if (isCompleted) {
          completedLessons++;
        } else if (firstUncompletedLessonId === null) {
          firstUncompletedLessonId = lesson.id;
        }

        return {
          ...lesson,
          isCompleted,
          watchedAt: completedMap.get(lesson.id) ?? null,
        };
      });

      return {
        id: section.id,
        title: section.title,
        order: section.order,
        lessons,
        completedCount: lessons.filter((l) => l.isCompleted).length,
        totalCount: lessons.length,
      };
    });

    const enrollmentInfo: EnrollmentInfo | null = enrollment
      ? {
          id: enrollment.id,
          progress: enrollment.progress,
          status: enrollment.status,
          isPassed: enrollment.isPassed,
          completedAt: enrollment.completedAt,
          createdAt: enrollment.createdAt,
        }
      : null;

    return {
      success: true,
      data: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        thumbnail: course.thumbnail,
        level: course.level,
        language: course.language,
        creator: course.creator,
        sections,
        enrollment: enrollmentInfo,
        totalLessons,
        completedLessons,
        firstUncompletedLessonId,
      },
    };
  } catch (error) {
    console.error("[GET_COURSE_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}