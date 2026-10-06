"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { ChatRoomType, CourseStatus, EnrollmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

// ─── Schema ───────────────────────────────────────────────────────────────────

const EnrollSchema = z.object({
  courseId: z.string().cuid("Invalid course ID."),
});

export type EnrollInCourseResult =
  | { success: true; enrollmentId: string; chatRoomId: string }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "COURSE_NOT_FOUND"
        | "NOT_PUBLISHED"
        | "ALREADY_ENROLLED"
        | "CANNOT_ENROLL_OWN_COURSE"
        | "INVALID_INPUT"
        | "SERVER_ERROR";
    };

// ─── Action ───────────────────────────────────────────────────────────────────

export async function enrollInCourseAction(
  input: z.infer<typeof EnrollSchema>
): Promise<EnrollInCourseResult> {
  try {
    // 1. Auth
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const userId = session.user.id;

    // 2. Validate
    const parsed = EnrollSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const { courseId } = parsed.data;

    // 3. Fetch course
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        price: true,
        status: true,
        creatorId: true,
      },
    });

    if (!course) return { success: false, error: "COURSE_NOT_FOUND" };
    if (course.status !== CourseStatus.PUBLISHED) {
      return { success: false, error: "NOT_PUBLISHED" };
    }
    if (course.creatorId === userId) {
      return { success: false, error: "CANNOT_ENROLL_OWN_COURSE" };
    }

    // 4. Check existing enrollment
    const existing = await db.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    });

    if (existing) return { success: false, error: "ALREADY_ENROLLED" };

    // 5. Atomic transaction: enrollment + chat room + participant
    const result = await db.$transaction(async (tx) => {
      // 5.1 Create enrollment
      const enrollment = await tx.enrollment.create({
        data: {
          userId,
          courseId,
          paidAmount: course.price,
          status: EnrollmentStatus.ACTIVE,
        },
        select: { id: true },
      });

      // 5.2 Find or create the course chat room (lazy)
      let chatRoom = await tx.chatRoom.findUnique({
        where: { courseId },
        select: { id: true },
      });

      if (!chatRoom) {
        // Create the course room on first enrollment
        chatRoom = await tx.chatRoom.create({
          data: {
            type: ChatRoomType.COURSE,
            courseId,
          },
          select: { id: true },
        });

        // Add the course creator (instructor) as a participant
        await tx.chatRoomParticipant.create({
          data: {
            userId: course.creatorId,
            chatRoomId: chatRoom.id,
          },
        });
      }

      // 5.3 Add the student to the room (idempotent)
      await tx.chatRoomParticipant.createMany({
        data: [
          { userId, chatRoomId: chatRoom.id },
        ],
        skipDuplicates: true,
      });

      return { enrollmentId: enrollment.id, chatRoomId: chatRoom.id };
    });

    // 6. Revalidate
    revalidatePath(`/courses`);
    revalidatePath(`/dashboard/student/courses`);
    revalidatePath(`/dashboard/chat`);

    return {
      success: true,
      enrollmentId: result.enrollmentId,
      chatRoomId: result.chatRoomId,
    };
  } catch (error) {
    console.error("[ENROLL_IN_COURSE_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}