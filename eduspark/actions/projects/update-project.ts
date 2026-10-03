"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { ProjectStatus, MilestoneStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

// ─── Shared Result Type ───────────────────────────────────────────────────────

export type ProjectActionResult =
  | { success: true }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "INVALID_TRANSITION"
        | "SERVER_ERROR";
      message?: string;
    };

// ─── Typed Error Helper ───────────────────────────────────────────────────────

class ActionError extends Error {
  constructor(
    public readonly code: string,
    message?: string
  ) {
    super(message ?? code);
    this.name = "ActionError";
  }
}

function isActionError(e: unknown): e is ActionError {
  return e instanceof ActionError;
}

// ─── Valid Status Transitions (immutable lookup table) ────────────────────────

const CREATOR_VALID_FROM: Partial<Record<MilestoneStatus, MilestoneStatus[]>> = {
  [MilestoneStatus.PENDING]: [MilestoneStatus.IN_PROGRESS],
  [MilestoneStatus.IN_PROGRESS]: [MilestoneStatus.REVIEW_REQUESTED],
  [MilestoneStatus.REVISION_NEEDED]: [MilestoneStatus.REVIEW_REQUESTED],
};

const CLIENT_VALID_FROM: Partial<Record<MilestoneStatus, MilestoneStatus[]>> = {
  [MilestoneStatus.REVIEW_REQUESTED]: [
    MilestoneStatus.APPROVED,
    MilestoneStatus.REVISION_NEEDED,
  ],
};

// ─── 1. Start Milestone — Creator only ───────────────────────────────────────

export async function startMilestoneAction(
  milestoneId: string
): Promise<ProjectActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };
    const { id: userId } = session.user;

    let projectId: string;

    await db.$transaction(async (tx) => {
      const milestone = await tx.milestone.findUnique({
        where: { id: milestoneId },
        select: {
          id: true,
          title: true,
          status: true,
          projectId: true,
          project: {
            select: {
              id: true,
              status: true,
              creatorId: true,
              chatRoom: { select: { id: true } },
            },
          },
        },
      });

      if (!milestone) throw new ActionError("NOT_FOUND");
      if (milestone.project.creatorId !== userId) {
        throw new ActionError("FORBIDDEN", "Only the assigned creator may start milestones.");
      }

      const allowed = CREATOR_VALID_FROM[milestone.status] ?? [];
      if (!allowed.includes(MilestoneStatus.IN_PROGRESS)) {
        throw new ActionError(
          "INVALID_TRANSITION",
          `Cannot start a milestone with status "${milestone.status}".`
        );
      }

      projectId = milestone.projectId;

      // ① Update milestone to IN_PROGRESS
      await tx.milestone.update({
        where: { id: milestoneId },
        data: { status: MilestoneStatus.IN_PROGRESS },
      });

      // ② Escalate project PENDING → IN_PROGRESS on first milestone start
      if (milestone.project.status === ProjectStatus.PENDING) {
        await tx.project.update({
          where: { id: milestone.projectId },
          data: { status: ProjectStatus.IN_PROGRESS },
        });
      }

      // ③ System message
      if (milestone.project.chatRoom?.id) {
        await tx.chatMessage.create({
          data: {
            chatRoomId: milestone.project.chatRoom.id,
            senderId: userId,
            isSystem: true,
            content: `Work has started on milestone: "${milestone.title}".`,
          },
        });
      }
    });

    revalidatePath(`/dashboard/projects/${projectId!}`);
    return { success: true };
  } catch (err) {
    if (isActionError(err)) {
      return {
        success: false,
        error: err.code as ProjectActionResult extends { error: infer E } ? E : never,
        message: err.message,
      } as ProjectActionResult;
    }
    console.error("[START_MILESTONE_ACTION]", err);
    return { success: false, error: "SERVER_ERROR" };
  }
}

// ─── 2. Request Milestone Review — Creator only ───────────────────────────────

export async function requestMilestoneReviewAction(
  milestoneId: string
): Promise<ProjectActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };
    const { id: userId } = session.user;

    let projectId: string;

    await db.$transaction(async (tx) => {
      const milestone = await tx.milestone.findUnique({
        where: { id: milestoneId },
        select: {
          id: true,
          title: true,
          status: true,
          projectId: true,
          project: {
            select: {
              id: true,
              status: true,
              creatorId: true,
              clientId: true,
              chatRoom: { select: { id: true } },
            },
          },
        },
      });

      if (!milestone) throw new ActionError("NOT_FOUND");
      if (milestone.project.creatorId !== userId) {
        throw new ActionError("FORBIDDEN", "Only the assigned creator may submit milestones for review.");
      }

      const validFromStatuses: MilestoneStatus[] = [
        MilestoneStatus.IN_PROGRESS,
        MilestoneStatus.REVISION_NEEDED,
      ];
      if (!validFromStatuses.includes(milestone.status)) {
        throw new ActionError(
          "INVALID_TRANSITION",
          `Cannot request review from status "${milestone.status}".`
        );
      }

      projectId = milestone.projectId;

      // ① Update this milestone
      await tx.milestone.update({
        where: { id: milestoneId },
        data: { status: MilestoneStatus.REVIEW_REQUESTED },
      });

      // ② Re-fetch all sibling milestones to determine project-level escalation.
      //    Simulate the updated state: treat the current milestone as already
      //    REVIEW_REQUESTED when evaluating the aggregate condition.
      const siblings = await tx.milestone.findMany({
        where: { projectId: milestone.projectId },
        select: { id: true, status: true },
      });

      const terminalStatuses = new Set<MilestoneStatus>([
        MilestoneStatus.REVIEW_REQUESTED,
        MilestoneStatus.APPROVED,
      ]);

      const allSubmitted = siblings.every((m) => {
        const effective =
          m.id === milestoneId ? MilestoneStatus.REVIEW_REQUESTED : m.status;
        return terminalStatuses.has(effective);
      });

      // ③ Escalate project → REVIEW_REQUESTED when all milestones are submitted
      if (allSubmitted && milestone.project.status === ProjectStatus.IN_PROGRESS) {
        await tx.project.update({
          where: { id: milestone.projectId },
          data: { status: ProjectStatus.REVIEW_REQUESTED },
        });

        await tx.notification.create({
          data: {
            userId: milestone.project.clientId,
            title: "Project Ready for Review ✅",
            body: "All milestones have been submitted. Review and approve to complete the project.",
            link: `/dashboard/projects/${milestone.projectId}`,
          },
        });
      }

      // ④ System message
      if (milestone.project.chatRoom?.id) {
        await tx.chatMessage.create({
          data: {
            chatRoomId: milestone.project.chatRoom.id,
            senderId: userId,
            isSystem: true,
            content: `Milestone "${milestone.title}" has been submitted for client review.`,
          },
        });
      }
    });

    revalidatePath(`/dashboard/projects/${projectId!}`);
    return { success: true };
  } catch (err) {
    if (isActionError(err)) {
      return { success: false, error: err.code as never, message: err.message } as ProjectActionResult;
    }
    console.error("[REQUEST_REVIEW_ACTION]", err);
    return { success: false, error: "SERVER_ERROR" };
  }
}

// ─── 3. Request Milestone Revision — Client only ──────────────────────────────

const RevisionSchema = z.object({
  milestoneId: z.string().cuid("Invalid milestone ID."),
  note: z
    .string()
    .min(10, "Revision note must be at least 10 characters.")
    .max(500, "Revision note must be at most 500 characters.")
    .trim(),
});

export async function requestMilestoneRevisionAction(
  milestoneId: string,
  note: string
): Promise<ProjectActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };
    const { id: userId } = session.user;

    const parsed = RevisionSchema.safeParse({ milestoneId, note });
    if (!parsed.success) {
      return {
        success: false,
        error: "INVALID_TRANSITION",
        message: parsed.error.issues[0]?.message,
      };
    }

    let projectId: string;

    await db.$transaction(async (tx) => {
      const milestone = await tx.milestone.findUnique({
        where: { id: milestoneId },
        select: {
          id: true,
          title: true,
          status: true,
          projectId: true,
          project: {
            select: {
              id: true,
              status: true,
              clientId: true,
              creatorId: true,
              chatRoom: { select: { id: true } },
            },
          },
        },
      });

      if (!milestone) throw new ActionError("NOT_FOUND");

      // ── Authorization guard: ONLY the client may request revisions.
      //    This prevents the creator from requesting revision on their
      //    own submitted work (an incoherent and potentially exploitable action).
      if (milestone.project.clientId !== userId) {
        throw new ActionError(
          "FORBIDDEN",
          "Only the client may request revisions on submitted work."
        );
      }

      const allowed = CLIENT_VALID_FROM[milestone.status] ?? [];
      if (!allowed.includes(MilestoneStatus.REVISION_NEEDED)) {
        throw new ActionError(
          "INVALID_TRANSITION",
          `Revisions can only be requested on milestones under review (current: "${milestone.status}").`
        );
      }

      projectId = milestone.projectId;

      // ① Mark milestone as needing revision, store the note
      await tx.milestone.update({
        where: { id: milestoneId },
        data: {
          status: MilestoneStatus.REVISION_NEEDED,
          revisionNote: note,
        },
      });

      // ② Revert project back to IN_PROGRESS (work is not done)
      if (milestone.project.status === ProjectStatus.REVIEW_REQUESTED) {
        await tx.project.update({
          where: { id: milestone.projectId },
          data: { status: ProjectStatus.IN_PROGRESS },
        });
      }

      // ③ Notify creator
      await tx.notification.create({
        data: {
          userId: milestone.project.creatorId!,
          title: "Revision Requested",
          body: `Client requested changes on "${milestone.title}". Note: ${note}`,
          link: `/dashboard/projects/${milestone.projectId}`,
        },
      });

      // ④ System message
      if (milestone.project.chatRoom?.id) {
        await tx.chatMessage.create({
          data: {
            chatRoomId: milestone.project.chatRoom.id,
            senderId: userId,
            isSystem: true,
            content: `Revision requested for "${milestone.title}". Feedback: "${note}"`,
          },
        });
      }
    });

    revalidatePath(`/dashboard/projects/${projectId!}`);
    return { success: true };
  } catch (err) {
    if (isActionError(err)) {
      return { success: false, error: err.code as never, message: err.message } as ProjectActionResult;
    }
    console.error("[REQUEST_REVISION_ACTION]", err);
    return { success: false, error: "SERVER_ERROR" };
  }
}

// ─── 4. Approve Project Completion — Client only ──────────────────────────────

export async function approveProjectCompletionAction(
  projectId: string
): Promise<ProjectActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };
    const { id: userId } = session.user;

    await db.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          title: true,
          status: true,
          clientId: true,
          creatorId: true,
          chatRoom: { select: { id: true } },
          milestones: { select: { id: true, status: true } },
        },
      });

      if (!project) throw new ActionError("NOT_FOUND");

      // ── Critical authorization guard ──────────────────────────────────────
      // ONLY the client can approve completion. The creator MUST NOT be able
      // to self-approve — this would undermine the escrow model entirely.
      if (project.clientId !== userId) {
        throw new ActionError(
          "FORBIDDEN",
          "Only the project client may approve completion. Creators cannot self-approve."
        );
      }

      // Project must be in REVIEW_REQUESTED state before approval
      if (project.status !== ProjectStatus.REVIEW_REQUESTED) {
        throw new ActionError(
          "INVALID_TRANSITION",
          `Project cannot be approved from status "${project.status}". All milestones must be submitted first.`
        );
      }

      // All milestones must be either REVIEW_REQUESTED or already APPROVED
      const allApprovable = project.milestones.every(
        (m) =>
          m.status === MilestoneStatus.REVIEW_REQUESTED ||
          m.status === MilestoneStatus.APPROVED
      );
      if (!allApprovable) {
        throw new ActionError(
          "INVALID_TRANSITION",
          "All milestones must be under review before the project can be approved."
        );
      }

      const now = new Date();

      // ① Approve all pending-review milestones in bulk
      await tx.milestone.updateMany({
        where: {
          projectId,
          status: MilestoneStatus.REVIEW_REQUESTED,
        },
        data: {
          status: MilestoneStatus.APPROVED,
          completedAt: now,
        },
      });

      // ② Mark project as COMPLETED
      await tx.project.update({
        where: { id: projectId },
        data: {
          status: ProjectStatus.COMPLETED,
          deadline: now,
        },
      });

      // ③ Notify creator — escrow release would be triggered from here in production
      if (project.creatorId) {
        await tx.notification.create({
          data: {
            userId: project.creatorId,
            title: "Project Completed 🎉",
            body: `"${project.title}" has been approved by the client. Payment will be released shortly.`,
            link: `/dashboard/projects/${projectId}`,
          },
        });
      }

      // ④ Closing system message
      if (project.chatRoom?.id) {
        await tx.chatMessage.create({
          data: {
            chatRoomId: project.chatRoom.id,
            senderId: userId,
            isSystem: true,
            content: "Project has been marked complete and all milestones approved. Thank you!",
          },
        });
      }
    });

    revalidatePath(`/dashboard/projects/${projectId}`);
    revalidatePath("/dashboard/projects");
    return { success: true };
  } catch (err) {
    if (isActionError(err)) {
      return { success: false, error: err.code as never, message: err.message } as ProjectActionResult;
    }
    console.error("[APPROVE_PROJECT_ACTION]", err);
    return { success: false, error: "SERVER_ERROR" };
  }
}