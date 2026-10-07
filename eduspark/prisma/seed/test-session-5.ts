// eduspark/prisma/seed/test-session-5.ts
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedReviews } from "./reviews";
import { seedChat } from "./chat";
import { seedNotifications } from "./notifications";
import { seedAiConversations } from "./ai-conversations";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

async function main(): Promise<void> {
  console.log("\n🧪 Session 5 Test Runner (Final)\n");

  const student = await db.user.findUniqueOrThrow({
    where: { email: "ahmad.student@eduspark.dev" },
  });
  const client = await db.user.findUniqueOrThrow({
    where: { email: "layla.client@eduspark.dev" },
  });
  const instructor = await db.user.findUniqueOrThrow({
    where: { email: "sarah.creator@eduspark.dev" },
  });
  const students = await db.user.findMany({
    where: {
      role: "STUDENT",
      email: { notIn: ["ahmad.student@eduspark.dev", "layla.client@eduspark.dev"] },
    },
  });
  const creators = await db.user.findMany({
    where: { role: "CREATOR", email: { not: "sarah.creator@eduspark.dev" } },
  });
  const allUsers = await db.user.findMany();
  const courses = await db.course.findMany();
  const projects = await db.project.findMany();

  if (courses.length === 0) throw new Error("Run Session 3a first.");

  const reviews = await seedReviews(db, { students, student, client }, { all: courses });
  const chat = await seedChat(
    db,
    { students, student, client, creators, instructor },
    { all: courses },
    { all: projects }
  );
  const notifications = await seedNotifications(db, { all: allUsers });
  const ai = await seedAiConversations(db, { all: allUsers });

  console.log("\n" + "═".repeat(60));
  console.log("  🎉 SESSION 5 FINAL SUMMARY");
  console.log("═".repeat(60));

  console.log(`\n⭐ Reviews: ${reviews.stats.total} (avg ${reviews.stats.averageRating}★)`);
  console.log(`💬 Chat: ${chat.stats.rooms} rooms (${chat.stats.courseRooms} course + ${chat.stats.projectRooms} project), ${chat.stats.messages} messages`);
  console.log(`🔔 Notifications: ${notifications.total} (${notifications.unread} unread)`);
  console.log(`🤖 AI: ${ai.conversations} conversations, ${ai.messages} messages`);

  const sampleReview = await db.review.findFirst({
    include: {
      user: { select: { name: true } },
      course: { select: { title: true } },
    },
  });

  if (sampleReview) {
    console.log(`\n🔍 Sample review:`);
    console.log(`   ${sampleReview.user.name} → ${sampleReview.course.title}`);
    console.log(`   ${sampleReview.rating}★: ${sampleReview.comment?.slice(0, 80)}`);
  }

  const sampleRoom = await db.chatRoom.findFirst({
    include: { _count: { select: { messages: true, participants: true } } },
  });

  if (sampleRoom) {
    console.log(`\n🔍 Sample chat room:`);
    console.log(`   Type: ${sampleRoom.type}`);
    console.log(`   Messages: ${sampleRoom._count.messages}, Participants: ${sampleRoom._count.participants}`);
  }

  const sampleAi = await db.aiConversation.findFirst({
    include: {
      _count: { select: { messages: true } },
      user: { select: { name: true } },
    },
  });

  if (sampleAi) {
    console.log(`\n🔍 Sample AI conversation:`);
    console.log(`   User: ${sampleAi.user.name} | Title: ${sampleAi.title} | Messages: ${sampleAi._count.messages}`);
  }

  console.log("\n🎉 Session 5 test complete!\n");
}

main()
  .catch((e) => {
    console.error("\n❌ Test failed:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });