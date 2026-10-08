"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { ServiceStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { cacheInvalidatePattern } from "@/lib/cache";
import { CacheKeys } from "@/lib/cache-keys";

const UpdateServiceSchema = z.object({
  serviceId: z.string().cuid(),
  action: z.enum(["CHANGE_STATUS"]),
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
});

export type UpdateServiceResult =
  | { success: true }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "FORBIDDEN"
        | "NOT_FOUND"
        | "INVALID_INPUT"
        | "SERVER_ERROR";
    };

export async function updateServiceAction(
  input: z.infer<typeof UpdateServiceSchema>
): Promise<UpdateServiceResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };
    if (session.user.role !== "ADMIN") {
      return { success: false, error: "FORBIDDEN" };
    }

    const parsed = UpdateServiceSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const { serviceId, action, status } = parsed.data;

    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: { id: true },
    });
    if (!service) return { success: false, error: "NOT_FOUND" };

    if (action === "CHANGE_STATUS" && status) {
      await db.service.update({
        where: { id: serviceId },
        data: { status: status as ServiceStatus },
      });
    }

    revalidatePath("/dashboard/admin/services");
    revalidatePath("/marketplace");

    await cacheInvalidatePattern(CacheKeys.patterns.allServices);

    return { success: true };
  } catch (error) {
    console.error("[UPDATE_SERVICE_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}