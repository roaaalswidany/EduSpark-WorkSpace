"use server";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { getFreshUser } from "@/lib/security/fresh-user";
import { s3Client, UPLOAD_BUCKET } from "@/lib/s3-client";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

const MAX_THUMBNAIL_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_THUMBNAIL_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export type ThumbnailUploadResult =
  | { success: true; url: string }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "FORBIDDEN"
        | "NOT_FOUND"
        | "NO_FILE"
        | "INVALID_TYPE"
        | "FILE_TOO_LARGE"
        | "SERVER_ERROR";
    };

export async function updateCourseThumbnailAction(
  formData: FormData
): Promise<ThumbnailUploadResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const actor = await getFreshUser(session.user.id);
    if (!actor?.isActive) return { success: false, error: "FORBIDDEN" };

    const file = formData.get("file");
    const courseId = formData.get("courseId");

    if (!(file instanceof File)) return { success: false, error: "NO_FILE" };
    if (typeof courseId !== "string" || !courseId) {
      return { success: false, error: "NOT_FOUND" };
    }
    if (!ALLOWED_THUMBNAIL_TYPES.has(file.type)) {
      return { success: false, error: "INVALID_TYPE" };
    }
    if (file.size > MAX_THUMBNAIL_SIZE) {
      return { success: false, error: "FILE_TOO_LARGE" };
    }

    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { creatorId: true },
    });
    if (!course) return { success: false, error: "NOT_FOUND" };

    const isOwner = course.creatorId === session.user.id;
    const isAdmin = actor.role === Role.ADMIN;
    if (!isOwner && !isAdmin) return { success: false, error: "FORBIDDEN" };

    const rawExt = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const ext = ["png", "jpg", "jpeg", "webp"].includes(rawExt) ? rawExt : "jpg";
    const storageKey = `courses/${courseId}/thumbnail-${randomUUID()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    await s3Client.send(
      new PutObjectCommand({
        Bucket: UPLOAD_BUCKET,
        Key: storageKey,
        Body: buffer,
        ContentType: file.type,
        ContentLength: buffer.length,
      })
    );

    // تنظيف الرابط: إزالة أي / مزدوجة في نهاية الـ Endpoint
    const baseUrl = (process.env.S3_ENDPOINT || "").replace(/\/+$/, "");
    const publicUrl = `${baseUrl}/${UPLOAD_BUCKET}/${storageKey}`;
    
    // 👇 هذه الطباعة ستظهر في الترمنال لنعرف الرابط بالضبط
    console.log("✅ [THUMBNAIL UPLOADED]:", publicUrl);

    await db.course.update({
      where: { id: courseId },
      data: { thumbnail: publicUrl },
    });

    revalidatePath(`/dashboard/creator/courses/${courseId}/edit`);
    revalidatePath("/dashboard/creator/courses");
    revalidatePath("/courses");

    return { success: true, url: publicUrl };
  } catch (err) {
    console.error("[UPDATE_COURSE_THUMBNAIL]", err);
    return { success: false, error: "SERVER_ERROR" };
  }
}