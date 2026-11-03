"use server";

import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { getFreshUser } from "@/lib/security/fresh-user";
import { limitByUser } from "@/lib/security/action-guard";
import { RateLimits } from "@/lib/security/rate-limit";
import { s3Client, UPLOAD_BUCKET } from "@/lib/s3-client";

const Schema = z.object({ attachmentId: z.string().cuid() });

export type GetDownloadUrlResult =
  | { success: true; downloadUrl: string; fileName: string }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "FORBIDDEN"
        | "NOT_FOUND"
        | "RATE_LIMITED"
        | "SERVER_ERROR";
    };

export async function getAttachmentDownloadUrlAction(
  rawInput: z.infer<typeof Schema>
): Promise<GetDownloadUrlResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    // Authoritative state from DB (JWT can be stale after suspension)
    const actor = await getFreshUser(session.user.id);
    if (!actor?.isActive) return { success: false, error: "FORBIDDEN" };

    // Rate limit: 120 per 10 minutes per user
    const retryAfter = await limitByUser(
      RateLimits.DOWNLOAD_URL,
      session.user.id
    );
    if (retryAfter !== null) return { success: false, error: "RATE_LIMITED" };

    const parsed = Schema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "NOT_FOUND" };

    const attachment = await db.attachment.findUnique({
      where: { id: parsed.data.attachmentId },
      select: {
        storageKey: true,
        fileName: true,
        status: true,
        uploadedById: true,
        milestone: {
          select: { project: { select: { clientId: true, creatorId: true } } },
        },
        chatRoom: { select: { participants: { select: { userId: true } } } },
        lesson: {
          select: {
            section: {
              select: {
                course: {
                  select: {
                    creatorId: true,
                    enrollments: {
                      where: { userId: session.user.id },
                      select: { id: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!attachment || attachment.status !== "CONFIRMED") {
      return { success: false, error: "NOT_FOUND" };
    }

    const userId = session.user.id;
    const isOwner = attachment.uploadedById === userId;
    const isProjectParticipant =
      attachment.milestone !== null &&
      (attachment.milestone.project.clientId === userId ||
        attachment.milestone.project.creatorId === userId);
    const isRoomParticipant =
      attachment.chatRoom?.participants.some((p) => p.userId === userId) ??
      false;

    const isLessonAccessible =
      attachment.lesson !== null &&
      (attachment.lesson.section.course.creatorId === userId ||
        attachment.lesson.section.course.enrollments.length > 0);

    if (
      !isOwner &&
      !isProjectParticipant &&
      !isRoomParticipant &&
      !isLessonAccessible
    ) {
      return { success: false, error: "FORBIDDEN" };
    }

    const downloadUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: UPLOAD_BUCKET,
        Key: attachment.storageKey,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(
          attachment.fileName
        )}`,
      }),
      { expiresIn: 120 }
    );

    return { success: true, downloadUrl, fileName: attachment.fileName };
  } catch (error) {
    console.error("[GET_ATTACHMENT_DOWNLOAD_URL_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}