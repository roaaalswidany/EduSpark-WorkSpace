"use server";

import { z } from "zod";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { getFreshUser } from "@/lib/security/fresh-user";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { s3Client, UPLOAD_BUCKET } from "@/lib/s3-client";

const Schema = z.object({ attachmentId: z.string().cuid() });

export async function deleteAttachmentAction(
  raw: z.infer<typeof Schema>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const user = await getFreshUser(session.user.id);
    if (!user?.isActive) return { success: false, error: "UNAUTHORIZED" };

    const { attachmentId } = Schema.parse(raw);

    const att = await db.attachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        storageKey: true,
        uploadedById: true,
        lesson: {
          select: {
            section: { select: { courseId: true, course: { select: { creatorId: true } } } },
          },
        },
      },
    });

    if (!att) return { success: false, error: "NOT_FOUND" };

    const isUploader = att.uploadedById === session.user.id;
    const isCourseOwner = att.lesson?.section.course.creatorId === session.user.id;
    const isAdmin = user.role === Role.ADMIN;

    if (!isUploader && !isCourseOwner && !isAdmin) {
      return { success: false, error: "FORBIDDEN" };
    }

    // Delete from S3 first, then DB. If S3 fails, keep the DB record.
    try {
      await s3Client.send(
        new DeleteObjectCommand({ Bucket: UPLOAD_BUCKET, Key: att.storageKey })
      );
    } catch (err) {
      console.warn("[DELETE_ATTACHMENT] S3 delete failed, continuing with DB:", err);
    }

    await db.attachment.delete({ where: { id: attachmentId } });

    if (att.lesson?.section.courseId) {
      revalidatePath(`/dashboard/creator/courses/${att.lesson.section.courseId}/edit`);
    }
    return { success: true };
  } catch (e) {
    console.error("[DELETE_ATTACHMENT]", e);
    return { success: false, error: "SERVER_ERROR" };
  }
}