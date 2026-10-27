"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { ChatRoomType, CourseStatus, EnrollmentStatus, Prisma } from "@prisma/client";
import { getFreshUser } from "@/lib/security/fresh-user";
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

    const actor = await getFreshUser(userId);
    if (!actor?.isActive) return { success: false, error: "UNAUTHORIZED" };

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
    let result: { enrollmentId: string; chatRoomId: string };
    try {
    result = await db.$transaction(async (tx) => {
      // 5.1 Create enrollment
      const enrollment = await tx.enrollment.create({
        data: {
          userId,
          courseId,
          // NOTE: no payment gateway exists yet; this records the list price only.
          paidAmount: course.price,
          status: EnrollmentStatus.ACTIVE,
        },
        select: { id: true },
      });

      // 5.2 Course chat room: upsert is race-safe (courseId is unique), unlike
      //     find-then-create where two first enrollments collide.
      // NOTE: Prisma's upsert is NOT atomic here — under concurrency it throws a
      // unique violation (verified by tests/gamification.test.ts). INSERT ..
      // ON CONFLICT DO NOTHING (skipDuplicates) followed by a read is.
      await tx.chatRoom.createMany({
        data: [{ type: ChatRoomType.COURSE, courseId }],
        skipDuplicates: true,
      });
      const chatRoom = await tx.chatRoom.findUniqueOrThrow({
        where: { courseId },
        select: { id: true },
      });

      // 5.3 Instructor + student as participants (idempotent)
      await tx.chatRoomParticipant.createMany({
        data: [
          { userId: course.creatorId, chatRoomId: chatRoom.id },
          { userId, chatRoomId: chatRoom.id },
        ],
        skipDuplicates: true,
      });

      return { enrollmentId: enrollment.id, chatRoomId: chatRoom.id };
    });
    } catch (txError) {
      // Lost a race for the same (user, course)? Only then is it "already enrolled".
      if (
        txError instanceof Prisma.PrismaClientKnownRequestError &&
        txError.code === "P2002" &&
        (await db.enrollment.findUnique({
          where: { userId_courseId: { userId, courseId } },
          select: { id: true },
        }))
      ) {
        return { success: false, error: "ALREADY_ENROLLED" };
      }
      throw txError;
    }

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