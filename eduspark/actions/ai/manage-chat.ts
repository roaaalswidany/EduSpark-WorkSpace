"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AiConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

export interface AiMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export type AiActionResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "INVALID_INPUT"
        | "SERVER_ERROR";
    };

// ─── Get User Conversations ──────────────────────────────────────────────────

export async function getConversationsAction(): Promise<
  AiActionResult<AiConversationSummary[]>
> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const conversations = await db.aiConversation.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });

    return {
      success: true,
      data: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt.toISOString(),
        messageCount: c._count.messages,
      })),
    };
  } catch (err) {
    console.error("[GET_CONVERSATIONS]", err);
    return { success: false, error: "SERVER_ERROR" };
  }
}

// ─── Get Single Conversation Messages ────────────────────────────────────────

const GetMessagesSchema = z.object({
  conversationId: z.string().cuid(),
});

export async function getConversationMessagesAction(
  input: z.infer<typeof GetMessagesSchema>
): Promise<AiActionResult<{ messages: AiMessageData[]; title: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const parsed = GetMessagesSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const conversation = await db.aiConversation.findUnique({
      where: { id: parsed.data.conversationId },
      select: {
        userId: true,
        title: true,
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) return { success: false, error: "NOT_FOUND" };
    if (conversation.userId !== session.user.id) {
      return { success: false, error: "FORBIDDEN" };
    }

    return {
      success: true,
      data: {
        title: conversation.title,
        messages: conversation.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
      },
    };
  } catch (err) {
    console.error("[GET_CONVERSATION_MESSAGES]", err);
    return { success: false, error: "SERVER_ERROR" };
  }
}

// ─── Delete Conversation ─────────────────────────────────────────────────────

const DeleteSchema = z.object({
  conversationId: z.string().cuid(),
});

export async function deleteConversationAction(
  input: z.infer<typeof DeleteSchema>
): Promise<AiActionResult<null>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const parsed = DeleteSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const conversation = await db.aiConversation.findUnique({
      where: { id: parsed.data.conversationId },
      select: { userId: true },
    });

    if (!conversation) return { success: false, error: "NOT_FOUND" };
    if (conversation.userId !== session.user.id) {
      return { success: false, error: "FORBIDDEN" };
    }

    await db.aiConversation.delete({
      where: { id: parsed.data.conversationId },
    });

    revalidatePath("/dashboard");
    return { success: true, data: null };
  } catch (err) {
    console.error("[DELETE_CONVERSATION]", err);
    return { success: false, error: "SERVER_ERROR" };
  }
}