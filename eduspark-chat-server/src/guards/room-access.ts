// ============================================================================
// حراسة الوصول للغرف — الطبقة الأمنية الثانية
//
// كل نوع من الغرف الثلاثة له منطق تحقّق مختلف من قاعدة البيانات.
// هذا الفصل يضمن وضوح القواعد الأمنية وسهولة صيانتها.
// ============================================================================

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import type { RoomType, ParsedRoomId } from "../types/socket.types";
import type { AuthenticatedUser } from "../types/socket.types";

export type RoomAccessResult =
  | {
      granted: true;
      roomId: string;
      metadata: {
        roomType: RoomType;
        targetId: string;
        targetName: string;
      };
    }
  | {
      granted: false;
      code: string;
      message: string;
    };

/**
 * parseRoomIdentifier: يُحوِّل النوع والمعرّف إلى كائن ParsedRoomId مُنظَّم
 */
export function parseRoomIdentifier(
  roomType: RoomType,
  targetId: string
): ParsedRoomId {
  const sanitizedTargetId = targetId.replace(/[^a-zA-Z0-9_-]/g, "");

  return {
    type: roomType,
    targetId: sanitizedTargetId,
    fullRoomId: `${roomType}-${sanitizedTargetId}`,
  };
}

/**
 * verifyRoomAccess: يتحقّق من حق المستخدم في الانضمام لغرفة محدَّدة
 *
 * القرارات الأمنية لكل نوع:
 *
 * course-study-group:
 *   ← يجب أن يكون المستخدم مسجَّلاً في المقرّر (Enrollment.status = ACTIVE/COMPLETED)
 *   ← أو أن يكون هو المدرِّس (course.instructorId = user.id)
 *   ← ADMIN يدخل دائماً
 *
 * project-workspace:
 *   ← يجب أن يكون المستخدم عميل المشروع أو المستقل المُعيَّن
 *   ← ADMIN يدخل دائماً
 *
 * support-channel:
 *   ← القناة شخصية: targetId يجب أن يطابق user.id
 *   ← ADMIN يستطيع الدخول لأي قناة دعم
 */
export async function verifyRoomAccess(
  user: AuthenticatedUser,
  parsed: ParsedRoomId
): Promise<RoomAccessResult> {
  // ADMIN له وصول كامل لكل الغرف
  if (user.role === "ADMIN") {
    return await buildAdminAccess(parsed);
  }

  switch (parsed.type) {
    case "course-study-group":
      return verifyCourseStudyGroupAccess(user, parsed);
    case "project-workspace":
      return verifyProjectWorkspaceAccess(user, parsed);
    case "support-channel":
      return verifySupportChannelAccess(user, parsed);
    default:
      return {
        granted: false,
        code: "INVALID_ROOM_TYPE",
        message: `Room type "${parsed.type}" is not supported.`,
      };
  }
}

// ─── Course Study Group Guard ────────────────────────────────────────────────

async function verifyCourseStudyGroupAccess(
  user: AuthenticatedUser,
  parsed: ParsedRoomId
): Promise<RoomAccessResult> {
  try {
    const course = await prisma.course.findUnique({
      where: { id: parsed.targetId },
      select: {
        id: true,
        title: true,
        status: true,
        instructorId: true,
      },
    });

    if (!course) {
      return {
        granted: false,
        code: "COURSE_NOT_FOUND",
        message: "The specified course does not exist.",
      };
    }

    if (course.status === "ARCHIVED") {
      return {
        granted: false,
        code: "COURSE_ARCHIVED",
        message: "This course has been archived and its study group is no longer accessible.",
      };
    }

    // المدرِّس يملك وصولاً كاملاً لغرفة مقرّره
    if (course.instructorId === user.id) {
      return {
        granted: true,
        roomId: parsed.fullRoomId,
        metadata: {
          roomType: parsed.type,
          targetId: parsed.targetId,
          targetName: course.title,
        },
      };
    }

    // التحقّق من تسجيل الطالب
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: parsed.targetId,
        },
      },
      select: { id: true, status: true },
    });

    if (!enrollment) {
      return {
        granted: false,
        code: "NOT_ENROLLED",
        message: "You must be enrolled in this course to access its study group.",
      };
    }

    if (enrollment.status === "CANCELLED" || enrollment.status === "REFUNDED") {
      return {
        granted: false,
        code: "ENROLLMENT_INACTIVE",
        message: "Your enrollment in this course is no longer active.",
      };
    }

    return {
      granted: true,
      roomId: parsed.fullRoomId,
      metadata: {
        roomType: parsed.type,
        targetId: parsed.targetId,
        targetName: course.title,
      },
    };
  } catch (error) {
    logger.error("Error verifying course study group access", {
      userId: user.id,
      courseId: parsed.targetId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return {
      granted: false,
      code: "VERIFICATION_ERROR",
      message: "Could not verify course access. Please try again.",
    };
  }
}

// ─── Project Workspace Guard ──────────────────────────────────────────────────

async function verifyProjectWorkspaceAccess(
  user: AuthenticatedUser,
  parsed: ParsedRoomId
): Promise<RoomAccessResult> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: parsed.targetId },
      select: {
        id: true,
        title: true,
        status: true,
        clientId: true,
        creatorId: true,
      },
    });

    if (!project) {
      return {
        granted: false,
        code: "PROJECT_NOT_FOUND",
        message: "The specified project does not exist.",
      };
    }

    if (project.status === "CANCELLED" || project.status === "COMPLETED") {
      // نسمح بالوصول للمشاريع المكتملة أو الملغاة للاطّلاع على السجلّ
      // لكن بدون إمكانية إرسال رسائل جديدة (ستُعالَج في message handler)
    }

    const isClient = project.clientId === user.id;
    const isCreator = project.creatorId === user.id;

    if (!isClient && !isCreator) {
      return {
        granted: false,
        code: "NOT_PROJECT_PARTICIPANT",
        message: "You are not a participant in this project workspace.",
      };
    }

    return {
      granted: true,
      roomId: parsed.fullRoomId,
      metadata: {
        roomType: parsed.type,
        targetId: parsed.targetId,
        targetName: project.title,
      },
    };
  } catch (error) {
    logger.error("Error verifying project workspace access", {
      userId: user.id,
      projectId: parsed.targetId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return {
      granted: false,
      code: "VERIFICATION_ERROR",
      message: "Could not verify project access. Please try again.",
    };
  }
}

// ─── Support Channel Guard ────────────────────────────────────────────────────

async function verifySupportChannelAccess(
  user: AuthenticatedUser,
  parsed: ParsedRoomId
): Promise<RoomAccessResult> {
  // قناة الدعم شخصية — targetId يجب أن يطابق user.id
  if (parsed.targetId !== user.id) {
    return {
      granted: false,
      code: "SUPPORT_CHANNEL_MISMATCH",
      message: "You can only access your own support channel.",
    };
  }

  return {
    granted: true,
    roomId: parsed.fullRoomId,
    metadata: {
      roomType: parsed.type,
      targetId: parsed.targetId,
      targetName: `Support Channel - ${user.name}`,
    },
  };
}

// ─── Admin Full Access ────────────────────────────────────────────────────────

async function buildAdminAccess(parsed: ParsedRoomId): Promise<RoomAccessResult> {
  let targetName = `${parsed.type}-${parsed.targetId}`;

  try {
    if (parsed.type === "course-study-group") {
      const course = await prisma.course.findUnique({
        where: { id: parsed.targetId },
        select: { title: true },
      });
      if (course) targetName = course.title;
    } else if (parsed.type === "project-workspace") {
      const project = await prisma.project.findUnique({
        where: { id: parsed.targetId },
        select: { title: true },
      });
      if (project) targetName = project.title;
    }
  } catch {
    // التابع مستمر حتى لو فشل جلب الاسم
  }

  return {
    granted: true,
    roomId: parsed.fullRoomId,
    metadata: {
      roomType: parsed.type,
      targetId: parsed.targetId,
      targetName,
    },
  };
}