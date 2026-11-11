"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { awardXP } from "@/lib/gamification/award";

const UpdateStepSchema = z.object({
  stepId: z.string().cuid(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]),
});

/**
 * Allowed state transitions: strictly FORWARD-ONLY.
 *   PENDING → IN_PROGRESS → COMPLETED (terminal)
 *
 * Why no IN_PROGRESS → PENDING: every PENDING → IN_PROGRESS move awards
 * CAREER_PATH_STEP_STARTED XP, so allowing a way back would let a user farm
 * unlimited XP by cycling start/pause (the UI has no such button, but the
 * server action can be called directly).
 */
const VALID_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
} as const;

export type UpdateStepResult =
  | { success: true; statusChanged: boolean }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "INVALID_INPUT"
        | "INVALID_TRANSITION"
        | "CONCURRENT_UPDATE"
        | "SERVER_ERROR";
    };

export async function updateStepStatusAction(
  input: z.infer<typeof UpdateStepSchema>
): Promise<UpdateStepResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const parsed = UpdateStepSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const { stepId, status } = parsed.data;
    const userId = session.user.id;

    // ── Transaction with compare-and-set to prevent double XP ─────
    const result = await db.$transaction(async (tx) => {
      const step = await tx.careerPathStep.findUnique({
        where: { id: stepId },
        select: {
          id: true,
          status: true,
          path: { select: { userId: true, id: true } },
        },
      });

      if (!step) throw new Error("NOT_FOUND");
      if (step.path.userId !== userId) throw new Error("FORBIDDEN");

      // Idempotent: no change → no XP, no DB write
      if (step.status === status) {
        return {
          statusChanged: false,
          newStatus: status,
          pathCompleted: false,
        };
      }

      // Validate transition
      const allowed = VALID_TRANSITIONS[step.status] ?? [];
      if (!allowed.includes(status)) {
        throw new Error("INVALID_TRANSITION");
      }

      // Compare-and-set: only ONE concurrent request wins
      const updated = await tx.careerPathStep.updateMany({
        where: { id: stepId, status: step.status },
        data: {
          status,
          completedAt: status === "COMPLETED" ? new Date() : null,
        },
      });
      if (updated.count !== 1) {
        throw new Error("CONCURRENT_UPDATE");
      }

      // Check if all steps are now completed
      const allSteps = await tx.careerPathStep.findMany({
        where: { pathId: step.path.id },
        select: { status: true },
      });
      const pathCompleted = allSteps.every((s) => s.status === "COMPLETED");

      if (pathCompleted) {
        await tx.careerPath.update({
          where: { id: step.path.id },
          data: { status: "COMPLETED" },
        });
      }

      return {
        statusChanged: true,
        newStatus: status,
        pathCompleted,
      };
    });

    // ── Award XP exactly once, only when status actually changed ──
    if (result.statusChanged) {
      if (result.newStatus === "IN_PROGRESS") {
        await awardXP(userId, "CAREER_PATH_STEP_STARTED").catch((err) =>
          console.error("[GAMIFICATION] step started XP:", err)
        );
      } else if (result.newStatus === "COMPLETED") {
        await awardXP(userId, "CAREER_PATH_STEP_COMPLETED").catch((err) =>
          console.error("[GAMIFICATION] step completed XP:", err)
        );
        if (result.pathCompleted) {
          await awardXP(userId, "CAREER_PATH_COMPLETED").catch((err) =>
            console.error("[GAMIFICATION] path completed XP:", err)
          );
        }
      }
    }

    revalidatePath("/dashboard/career-path");
    return { success: true, statusChanged: result.statusChanged };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND")
        return { success: false, error: "NOT_FOUND" };
      if (error.message === "FORBIDDEN")
        return { success: false, error: "FORBIDDEN" };
      if (error.message === "INVALID_TRANSITION")
        return { success: false, error: "INVALID_TRANSITION" };
      if (error.message === "CONCURRENT_UPDATE")
        return { success: false, error: "CONCURRENT_UPDATE" };
    }
    console.error("[UPDATE_STEP_STATUS_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}