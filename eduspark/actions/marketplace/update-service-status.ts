"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { ServiceStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

const UpdateStatusSchema = z.object({
  serviceId: z.string().cuid(),
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]),
});

export type UpdateServiceStatusResult =
  | { success: true; newStatus: ServiceStatus }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "INVALID_INPUT"
        | "SERVER_ERROR";
    };

export async function updateServiceStatusAction(
  input: z.infer<typeof UpdateStatusSchema>
): Promise<UpdateServiceStatusResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const parsed = UpdateStatusSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const { serviceId, status } = parsed.data;

    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: { creatorId: true },
    });

    if (!service) return { success: false, error: "NOT_FOUND" };
    if (service.creatorId !== session.user.id) {
      return { success: false, error: "FORBIDDEN" };
    }

    const updated = await db.service.update({
      where: { id: serviceId },
      data: { status },
      select: { status: true },
    });

    revalidatePath("/dashboard/creator/services");
    revalidatePath("/marketplace");

    return { success: true, newStatus: updated.status };
  } catch (error) {
    console.error("[UPDATE_SERVICE_STATUS_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}