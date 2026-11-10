"use server";

import { z } from "zod";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { getFreshUser } from "@/lib/security/fresh-user";
import { limitByUser } from "@/lib/security/action-guard";
import { RateLimits } from "@/lib/security/rate-limit";
import { s3Client } from "@/lib/s3-client";
import {
  publicBucket,
  publicObjectUrl,
  keyFromPublicUrl,
  serviceThumbnailKey,
  sniffImage,
} from "@/lib/storage/public-objects";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

const MAX_THUMBNAIL_SIZE = 2 * 1024 * 1024; // 2 MB
const ServiceIdSchema = z.string().cuid();

export type ServiceThumbnailUploadResult =
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
        | "SERVICE_LOCKED"
        | "RATE_LIMITED"
        | "SERVER_ERROR";
    };

export async function updateServiceThumbnailAction(
  formData: FormData
): Promise<ServiceThumbnailUploadResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const actor = await getFreshUser(session.user.id);
    if (!actor?.isActive) return { success: false, error: "FORBIDDEN" };

    const retryAfter = await limitByUser(RateLimits.THUMBNAIL_UPLOAD, session.user.id);
    if (retryAfter !== null) return { success: false, error: "RATE_LIMITED" };

    const file = formData.get("file");
    if (!(file instanceof File)) return { success: false, error: "NO_FILE" };
    const idParsed = ServiceIdSchema.safeParse(formData.get("serviceId"));
    if (!idParsed.success) return { success: false, error: "NOT_FOUND" };
    const serviceId = idParsed.data;

    if (file.size > MAX_THUMBNAIL_SIZE) return { success: false, error: "FILE_TOO_LARGE" };

    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: { creatorId: true, status: true, thumbnail: true },
    });
    if (!service) return { success: false, error: "NOT_FOUND" };

    const isOwner = service.creatorId === session.user.id;
    const isAdmin = actor.role === Role.ADMIN;
    if (!isOwner && !isAdmin) return { success: false, error: "FORBIDDEN" };

    // What the reviewer is looking at must not change under their feet.
    if (service.status === "PENDING_REVIEW" && !isAdmin) {
      return { success: false, error: "SERVICE_LOCKED" };
    }

    // Trust the bytes, not the browser: identify the image by its magic numbers.
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_THUMBNAIL_SIZE) return { success: false, error: "FILE_TOO_LARGE" };
    const kind = sniffImage(buffer);
    if (!kind) return { success: false, error: "INVALID_TYPE" };

    // `public/` prefix: the only part of the bucket that is anonymously readable.
    const storageKey = serviceThumbnailKey(serviceId, randomUUID(), kind.ext);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: publicBucket(),
        Key: storageKey,
        Body: buffer,
        ContentType: kind.mime, // detected, never the client-declared type
        ContentLength: buffer.length,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const publicUrl = publicObjectUrl(storageKey);
    await db.service.update({ where: { id: serviceId }, data: { thumbnail: publicUrl } });

    // Best-effort cleanup of the previous image (never fails the upload).
    const oldKey = keyFromPublicUrl(service.thumbnail);
    if (oldKey && oldKey !== storageKey) {
      try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: publicBucket(), Key: oldKey }));
      } catch (err) {
        console.error("[SERVICE_THUMBNAIL_CLEANUP]", err);
      }
    }

    revalidatePath(`/dashboard/creator/services/${serviceId}/edit`);
    revalidatePath("/dashboard/creator/services");
    revalidatePath("/marketplace");

    return { success: true, url: publicUrl };
  } catch (err) {
    console.error("[UPDATE_SERVICE_THUMBNAIL]", err);
    return { success: false, error: "SERVER_ERROR" };
  }
}
