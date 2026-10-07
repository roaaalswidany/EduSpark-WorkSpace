// eduspark/prisma/seed/cleanup.ts
// ─────────────────────────────────────────────────────────────────────────────
// Deletes ALL seed data in correct FK-safe order (children → parents).
// Protected users (PROTECTED_EMAILS) are preserved.
// ─────────────────────────────────────────────────────────────────────────────

import type { PrismaClient } from "@prisma/client";
import { PROTECTED_EMAILS } from "./config";
import { logHeader, logInfo, logSuccess } from "./helpers";

export async function cleanupAll(db: PrismaClient): Promise<void> {
  logHeader("🧹 Step 0: Cleanup");

  const protectedUsers = await db.user.findMany({
    where: { email: { in: [...PROTECTED_EMAILS] } },
    select: { id: true },
  });

  logInfo(`Protected accounts: ${protectedUsers.length}`);

  // ── Level 1: Deepest children ──────────────────────────────────
  await db.attachment.deleteMany({});
  await db.quizAnswer.deleteMany({});
  await db.lessonProgress.deleteMany({});
  await db.certificate.deleteMany({});
  await db.quizAttempt.deleteMany({});
  await db.chatMessage.deleteMany({});
  await db.orderMessage.deleteMany({});

  // ── Level 2: Mid-level children ────────────────────────────────
  await db.chatRoomParticipant.deleteMany({});
  await db.milestone.deleteMany({});
  await db.proposal.deleteMany({});
  await db.review.deleteMany({});

  // ── Level 3: Parents ───────────────────────────────────────────
  await db.chatRoom.deleteMany({});
  await db.order.deleteMany({});
  await db.project.deleteMany({});
  await db.enrollment.deleteMany({});
  await db.notification.deleteMany({});
  await db.aiMessage.deleteMany({});
  await db.aiConversation.deleteMany({});

  // ── Level 4: Content ───────────────────────────────────────────
  await db.question.deleteMany({});
  await db.quiz.deleteMany({});
  await db.lesson.deleteMany({});
  await db.section.deleteMany({});
  await db.course.deleteMany({});
  await db.service.deleteMany({});
  await db.category.deleteMany({});

  // ── Level 5: Users (except protected) ──────────────────────────
  const deleted = await db.user.deleteMany({
    where: { email: { notIn: [...PROTECTED_EMAILS] } },
  });

  logSuccess(`Cleanup complete — ${deleted.count} users removed`);
}