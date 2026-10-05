"use server";

import { z } from "zod";
import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import {
  s3Client,
  UPLOAD_BUCKET,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from "@/lib/s3-client";

// ─── Schema ───────────────────────────────────────────────────────────────────

const RequestUploadSchema = z.object({
  fileName: z.string().min(1, "File name is required.").max(255),
  mimeType: z.string().refine((v) => ALLOWED_MIME_TYPES.has(v), {
    message: "This file type is not permitted.",
  }),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_FILE_SIZE_BYTES, "File exceeds the 25MB limit."),
  context: z.enum(["MILESTONE", "CHAT_ROOM"]),
  contextId: z.string().cuid("Invalid context identifier."),
});

export type RequestUploadInput = z.infer<typeof RequestUploadSchema>;

export type RequestUploadResult =
  | {
      success: true;
      attachmentId: string;
      uploadUrl: string;
      storageKey: string;
      expiresInSeconds: number;
    }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "INVALID_INPUT"
        | "FORBIDDEN"
        | "CONTEXT_NOT_FOUND"
        | "SERVER_ERROR";
      fieldErrors?: Partial<Record<keyof RequestUploadInput, string[]>>;
    };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100);
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function requestUploadAction(
  rawInput: RequestUploadInput
): Promise<RequestUploadResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };
    const userId = session.user.id;

    const parsed = RequestUploadSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "INVALID_INPUT",
        fieldErrors: parsed.error.flatten().fieldErrors as Partial<
          Record<keyof RequestUploadInput, string[]>
        >,
      };
    }

    const { fileName, mimeType, fileSizeBytes, context, contextId } = parsed.data;

    // ── بوّابة التفويض: التحقّق أن المستخدم فعلياً مخوَّل لرفع ملف لهذا السياق ──
    if (context === "MILESTONE") {
      const milestone = await db.milestone.findUnique({
        where: { id: contextId },
        select: { project: { select: { clientId: true, creatorId: true } } },
      });

      if (!milestone) return { success: false, error: "CONTEXT_NOT_FOUND" };

      const isParticipant =
        milestone.project.clientId === userId ||
        milestone.project.creatorId === userId;

      if (!isParticipant) return { success: false, error: "FORBIDDEN" };
    } else {
      const participant = await db.chatRoomParticipant.findUnique({
        where: { userId_chatRoomId: { userId, chatRoomId: contextId } },
        select: { userId: true },
      });

      if (!participant) return { success: false, error: "FORBIDDEN" };
    }

    // ── مفتاح تخزين فريد ومُنظَّم هرمياً، يمنع تعارض الأسماء ─────────────────
    const storageKey = `${context.toLowerCase()}/${contextId}/${randomUUID()}-${sanitizeFileName(fileName)}`;

    // ── ContentLength هنا ليس تفصيلاً ثانوياً: تثبيته داخل الأمر الموقَّع يجعل
    //    التوقيع غير صالح لو حاول العميل رفع ملف بحجم مختلف عمّا أعلن عنه،
    //    وهذا يمنع ثغرة "تجاوز الحجم عبر رابط موقَّع صغير" (Signed-Size Bypass)
    const command = new PutObjectCommand({
      Bucket: UPLOAD_BUCKET,
      Key: storageKey,
      ContentType: mimeType,
      ContentLength: fileSizeBytes,
    });

    const expiresInSeconds = 300; // 5 دقائق كافية لإكمال أي رفع طبيعي
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });

    const attachment = await db.attachment.create({
      data: {
        fileName,
        mimeType,
        fileSizeBytes,
        storageKey,
        status: "PENDING",
        uploadedById: userId,
        ...(context === "MILESTONE"
          ? { milestoneId: contextId }
          : { chatRoomId: contextId }),
      },
      select: { id: true },
    });

    return {
      success: true,
      attachmentId: attachment.id,
      uploadUrl,
      storageKey,
      expiresInSeconds,
    };
  } catch (error) {
    console.error("[REQUEST_UPLOAD_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}