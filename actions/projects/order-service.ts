"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import {
  ProjectStatus,
  MilestoneStatus,
  ChatRoomType,
  ServiceStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

// ─── Utility ──────────────────────────────────────────────────────────────────

function addCalendarDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const OrderServiceSchema = z.object({
  serviceId: z.string().cuid("Invalid service ID."),
  requirements: z
    .string()
    .min(20, "Please describe your requirements in at least 20 characters.")
    .max(2000, "Requirements must be at most 2000 characters.")
    .trim(),
});

export type OrderServiceInput = z.infer<typeof OrderServiceSchema>;

export type OrderServiceResult =
  | { success: true; projectId: string; chatRoomId: string }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "INVALID_INPUT"
        | "SERVICE_NOT_FOUND"
        | "SERVICE_INACTIVE"
        | "SELF_ORDER"
        | "SERVER_ERROR";
      fieldErrors?: Partial<Record<keyof OrderServiceInput, string[]>>;
    };

// ─── Action ───────────────────────────────────────────────────────────────────

export async function orderServiceAction(
  rawInput: OrderServiceInput
): Promise<OrderServiceResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const { id: clientId, name: clientName } = session.user;

    const parsed = OrderServiceSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "INVALID_INPUT",
        fieldErrors: parsed.error.flatten().fieldErrors as Partial
          Record<keyof OrderServiceInput, string[]>
        >,
      };
    }

    const { serviceId, requirements } = parsed.data;

    // ── Fetch service with creator ────────────────────────────────────────────
    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        title: true,
        price: true,
        deliveryDays: true,
        status: true,
        creatorId: true,
        creator: { select: { id: true, name: true } },
      },
    });

    if (!service) return { success: false, error: "SERVICE_NOT_FOUND" };
    if (service.status !== ServiceStatus.ACTIVE) {
      return { success: false, error: "SERVICE_INACTIVE" };
    }
    // Prevent a creator from ordering their own service
    if (service.creatorId === clientId) {
      return { success: false, error: "SELF_ORDER" };
    }

    const deliveryDeadline = addCalendarDays(new Date(), service.deliveryDays);
    const deadlineFmt = deliveryDeadline.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    // ── Atomic transaction ────────────────────────────────────────────────────
    //   ① Create Project
    //   ② Create Milestone(s) derived from Service definition
    //   ③ Create ChatRoom of type PROJECT
    //   ④ Add both parties as ChatRoom participants
    //   ⑤ Post system message to open the conversation
    //   ⑥ Notify the creator

    const { project, chatRoom } = await db.$transaction(async (tx) => {
      // ① Project
      const project = await tx.project.create({
        data: {
          title: `${service.title} — Order`,
          description: requirements,
          budget: service.price,
          deadline: deliveryDeadline,
          status: ProjectStatus.PENDING,
          tags: [],
          clientId,
          creatorId: service.creatorId,
          serviceId,
        },
        select: { id: true },
      });

      // ② Default milestone derived from service delivery definition.
      //    The creator may later add additional granular milestones if desired.
      await tx.milestone.create({
        data: {
          title: "Final Delivery",
          description: `Complete and deliver all requirements for "${service.title}".`,
          dueDate: deliveryDeadline,
          status: MilestoneStatus.PENDING,
          order: 1,
          amount: service.price,
          projectId: project.id,
        },
      });

      // ③ ChatRoom
      const chatRoom = await tx.chatRoom.create({
        data: { type: ChatRoomType.PROJECT, projectId: project.id },
        select: { id: true },
      });

      // ④ Participants
      await tx.chatRoomParticipant.createMany({
        data: [
          { userId: clientId, chatRoomId: chatRoom.id },
          { userId: service.creatorId, chatRoomId: chatRoom.id },
        ],
        skipDuplicates: true,
      });

      // ⑤ System message
      await tx.chatMessage.create({
        data: {
          chatRoomId: chatRoom.id,
          senderId: clientId,
          isSystem: true,
          content: `Project created. Delivery expected by ${deadlineFmt}.`,
        },
      });

      // ⑥ Creator notification
      await tx.notification.create({
        data: {
          userId: service.creatorId,
          title: "New Project Order 🎯",
          body: `${clientName ?? "A client"} ordered "${service.title}". Review the requirements and begin work.`,
          link: `/dashboard/projects/${project.id}`,
        },
      });

      return { project, chatRoom };
    });

    revalidatePath("/dashboard/projects");

    return {
      success: true,
      projectId: project.id,
      chatRoomId: chatRoom.id,
    };
  } catch (error) {
    console.error("[ORDER_SERVICE_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}