"use server";

import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { s3Client, UPLOAD_BUCKET } from "@/lib/s3-client";

const Schema = z.object({ attachmentId: z.string().cuid() });

export type GetDownloadUrlResult =
  | { success: true; downloadUrl: string; fileName: string }
  | { success: false; error: "UNAUTHORIZED" | "NOT_FOUND" | "FORBIDDEN" | "SERVER_ERROR" };

export async function getAttachmentDownloadUrlAction(
  rawInput: z.infer<typeof Schema>
): Promise<GetDownloadUrlResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

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
      attachment.chatRoom?.participants.some((p) => p.userId === userId) ?? false;

    if (!isOwner && !isProjectParticipant && !isRoomParticipant) {
      return { success: false, error: "FORBIDDEN" };
    }

    const downloadUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: UPLOAD_BUCKET, Key: attachment.storageKey }),
      { expiresIn: 120 } // نافذة زمنية أضيق عمداً، لأنه رابط استهلاك فوري لا رفع
    );

    return { success: true, downloadUrl, fileName: attachment.fileName };
  } catch (error) {
    console.error("[GET_ATTACHMENT_DOWNLOAD_URL_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}