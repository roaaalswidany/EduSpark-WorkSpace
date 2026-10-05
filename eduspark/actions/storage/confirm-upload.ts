"use server";

import { z } from "zod";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { s3Client, UPLOAD_BUCKET } from "@/lib/s3-client";
import { revalidatePath } from "next/cache";

const ConfirmUploadSchema = z.object({
  attachmentId: z.string().cuid(),
});

export type ConfirmUploadResult =
  | { success: true }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "UPLOAD_NOT_FOUND_IN_STORAGE"
        | "SERVER_ERROR";
    };

export async function confirmUploadAction(
  rawInput: z.infer<typeof ConfirmUploadSchema>
): Promise<ConfirmUploadResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const parsed = ConfirmUploadSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "NOT_FOUND" };

    const attachment = await db.attachment.findUnique({
      where: { id: parsed.data.attachmentId },
    });

    if (!attachment) return { success: false, error: "NOT_FOUND" };
    if (attachment.uploadedById !== session.user.id) {
      return { success: false, error: "FORBIDDEN" };
    }

    // ── لا نثق بإخبار العميل أن الرفع نجح — نتحقّق فعلياً من وجود الكائن في S3
    try {
      await s3Client.send(
        new HeadObjectCommand({ Bucket: UPLOAD_BUCKET, Key: attachment.storageKey })
      );
    } catch {
      await db.attachment.update({
        where: { id: attachment.id },
        data: { status: "FAILED" },
      });
      return { success: false, error: "UPLOAD_NOT_FOUND_IN_STORAGE" };
    }

    await db.attachment.update({
      where: { id: attachment.id },
      data: { status: "CONFIRMED" },
    });

    if (attachment.milestoneId) revalidatePath("/dashboard/projects");

    return { success: true };
  } catch (error) {
    console.error("[CONFIRM_UPLOAD_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}