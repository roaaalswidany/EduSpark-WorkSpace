"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

const DeleteServiceSchema = z.object({
  serviceId: z.string().cuid(),
});

export type DeleteServiceResult =
  | { success: true }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "HAS_ORDERS"
        | "INVALID_INPUT"
        | "SERVER_ERROR";
    };

export async function deleteServiceAction(
  input: z.infer<typeof DeleteServiceSchema>
): Promise<DeleteServiceResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const parsed = DeleteServiceSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const { serviceId } = parsed.data;

    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: {
        creatorId: true,
        _count: { select: { orders: true, projects: true } },
      },
    });

    if (!service) return { success: false, error: "NOT_FOUND" };
    if (service.creatorId !== session.user.id) {
      return { success: false, error: "FORBIDDEN" };
    }
    if (service._count.orders > 0 || service._count.projects > 0) {
      return { success: false, error: "HAS_ORDERS" };
    }

    await db.service.delete({ where: { id: serviceId } });

    revalidatePath("/dashboard/creator/services");
    revalidatePath("/marketplace");

    return { success: true };
  } catch (error) {
    console.error("[DELETE_SERVICE_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}