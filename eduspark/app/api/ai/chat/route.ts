/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { classifyIntent } from "@/lib/ai/intent-classifier";
import { buildUserContext } from "@/lib/ai/context-builder";
import { generateResponse } from "@/lib/ai/response-generator";
import { chatWithGemini, type GeminiMessage } from "@/lib/ai/gemini";

export const dynamic = "force-dynamic";

// ─── Validation ──────────────────────────────────────────────────────────────

const ChatSchema = z.object({
  message: z.string().min(1, "Message cannot be empty.").max(2000),
  conversationId: z.string().cuid().optional().nullable(),
});

// ─── POST /api/ai/chat ───────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = ChatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "INVALID_INPUT",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { message, conversationId } = parsed.data;
    const userId = session.user.id;

    // ── Build user context ────────────────────────────────────────
    const context = await buildUserContext(userId);
    if (!context) {
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    }

    // ── Fetch conversation history (if existing) ──────────────────
    let history: GeminiMessage[] = [];
    let existingConversationTitle: string | null = null;

    if (conversationId) {
      const existing = await db.aiConversation.findUnique({
        where: { id: conversationId },
        select: {
          userId: true,
          title: true,
          messages: {
            orderBy: { createdAt: "asc" },
            take: 20,
            select: { role: true, content: true },
          },
        },
      });

      if (!existing || existing.userId !== userId) {
        return NextResponse.json(
          { error: "CONVERSATION_NOT_FOUND" },
          { status: 404 }
        );
      }

      existingConversationTitle = existing.title;
      history = existing.messages.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }));
    }

    // ── Try Gemini first ──────────────────────────────────────────
    let assistantContent: string;
    let suggestions: Array<{ label: string; href: string }> = [];
    let usedFallback = false;

    const geminiResult = await chatWithGemini(message, context, history);

    if (geminiResult.success) {
      assistantContent = geminiResult.content;
    } else {
      // ── Fallback: Local rule-based ─────────────────────────────
      usedFallback = true;
      const classification = classifyIntent(message);
      const generated = generateResponse(
        classification.intent,
        classification.language,
        context
      );
      assistantContent = generated.content;
      suggestions = generated.suggestions;

      if (geminiResult.error === "RATE_LIMITED") {
        // gentle note appended
        assistantContent +=
          "\n\n---\n_ملاحظة: المساعد الذكي مشغول حالياً، أجبتك بالإجابة الأساسية._";
      }
    }

    // ── Save to DB (transaction) ──────────────────────────────────
    const result = await db.$transaction(async (tx) => {
      let conversation;

      if (conversationId) {
        conversation = await tx.aiConversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
          select: { id: true, title: true },
        });
      } else {
        const title =
          message.length > 40 ? `${message.slice(0, 40)}…` : message;
        conversation = await tx.aiConversation.create({
          data: { userId, title },
          select: { id: true, title: true },
        });
      }

      const userMessage = await tx.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: "user",
          content: message,
        },
        select: { id: true, createdAt: true },
      });

      const assistantMessage = await tx.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: assistantContent,
        },
        select: { id: true, createdAt: true },
      });

      return {
        conversationId: conversation.id,
        conversationTitle: conversation.title,
        userMessage: {
          id: userMessage.id,
          role: "user" as const,
          content: message,
          createdAt: userMessage.createdAt.toISOString(),
        },
        assistantMessage: {
          id: assistantMessage.id,
          role: "assistant" as const,
          content: assistantContent,
          createdAt: assistantMessage.createdAt.toISOString(),
        },
      };
    });

    return NextResponse.json(
      {
        ...result,
        suggestions,
        usedFallback,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[AI_CHAT_ROUTE]", error);

    if (error instanceof Error && error.message === "CONVERSATION_NOT_FOUND") {
      return NextResponse.json(
        { error: "CONVERSATION_NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}