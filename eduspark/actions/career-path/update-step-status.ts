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

export type UpdateStepResult =
  | { success: true }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "INVALID_INPUT"
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

    const step = await db.careerPathStep.findUnique({
      where: { id: stepId },
      select: {
        id: true,
        path: { select: { userId: true, id: true } },
      },
    });

    if (!step) return { success: false, error: "NOT_FOUND" };
    if (step.path.userId !== session.user.id) {
      return { success: false, error: "FORBIDDEN" };
    }

    await db.careerPathStep.update({
      where: { id: stepId },
      data: {
        status,
        completedAt: status === "COMPLETED" ? new Date() : null,
      },
    });

    // If all steps completed → mark path as COMPLETED
    const allSteps = await db.careerPathStep.findMany({
      where: { pathId: step.path.id },
      select: { status: true },
    });

    const allDone = allSteps.every((s) => s.status === "COMPLETED");
    if (allDone) {
      await db.careerPath.update({
        where: { id: step.path.id },
        data: { status: "COMPLETED" },
      });
    }

    // ── Award XP based on new status (fire-and-forget) ──────────────
    if (status === "IN_PROGRESS") {
      void awardXP(session.user.id, "CAREER_PATH_STEP_STARTED").catch((err) =>
        console.error("[GAMIFICATION] step started XP:", err)
      );
    } else if (status === "COMPLETED") {
      void awardXP(session.user.id, "CAREER_PATH_STEP_COMPLETED").catch(
        (err) => console.error("[GAMIFICATION] step completed XP:", err)
      );

      // If this completed the whole path, award the completion bonus
      const allSteps = await db.careerPathStep.findMany({
        where: { pathId: step.path.id },
        select: { status: true },
      });
      if (allSteps.every((s) => s.status === "COMPLETED")) {
        void awardXP(session.user.id, "CAREER_PATH_COMPLETED").catch((err) =>
          console.error("[GAMIFICATION] path completed XP:", err)
        );
      }
    }

    // ── Award XP based on new status (fire-and-forget) ──────────────
    if (status === "IN_PROGRESS") {
      void awardXP(session.user.id, "CAREER_PATH_STEP_STARTED").catch((err) =>
        console.error("[GAMIFICATION] step started XP:", err)
      );
    } else if (status === "COMPLETED") {
      void awardXP(session.user.id, "CAREER_PATH_STEP_COMPLETED").catch(
        (err) => console.error("[GAMIFICATION] step completed XP:", err)
      );

      // If this completed the whole path, award the completion bonus
      const allSteps = await db.careerPathStep.findMany({
        where: { pathId: step.path.id },
        select: { status: true },
      });
      if (allSteps.every((s) => s.status === "COMPLETED")) {
        void awardXP(session.user.id, "CAREER_PATH_COMPLETED").catch((err) =>
          console.error("[GAMIFICATION] path completed XP:", err)
        );
      }
    }

     // ── Award XP based on new status (fire-and-forget) ──────────────
    if (status === "IN_PROGRESS") {
      void awardXP(session.user.id, "CAREER_PATH_STEP_STARTED").catch((err) =>
        console.error("[GAMIFICATION] step started XP:", err)
      );
    } else if (status === "COMPLETED") {
      void awardXP(session.user.id, "CAREER_PATH_STEP_COMPLETED").catch(
        (err) => console.error("[GAMIFICATION] step completed XP:", err)
      );

      // If this completed the whole path, award the completion bonus
      const allSteps = await db.careerPathStep.findMany({
        where: { pathId: step.path.id },
        select: { status: true },
      });
      if (allSteps.every((s) => s.status === "COMPLETED")) {
        void awardXP(session.user.id, "CAREER_PATH_COMPLETED").catch((err) =>
          console.error("[GAMIFICATION] path completed XP:", err)
        );
      }
    }

    // ── Award XP based on new status (fire-and-forget) ──────────────
    if (status === "IN_PROGRESS") {
      void awardXP(session.user.id, "CAREER_PATH_STEP_STARTED").catch((err) =>
        console.error("[GAMIFICATION] step started XP:", err)
      );
    } else if (status === "COMPLETED") {
      void awardXP(session.user.id, "CAREER_PATH_STEP_COMPLETED").catch(
        (err) => console.error("[GAMIFICATION] step completed XP:", err)
      );

      // If this completed the whole path, award the completion bonus
      const allSteps = await db.careerPathStep.findMany({
        where: { pathId: step.path.id },
        select: { status: true },
      });
      if (allSteps.every((s) => s.status === "COMPLETED")) {
        void awardXP(session.user.id, "CAREER_PATH_COMPLETED").catch((err) =>
          console.error("[GAMIFICATION] path completed XP:", err)
        );
      }
    }

    revalidatePath("/dashboard/career-path");

    return { success: true };
  } catch (error) {
    console.error("[UPDATE_STEP_STATUS_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}