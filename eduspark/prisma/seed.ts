/* eslint-disable @typescript-eslint/no-unused-vars */
// eduspark/prisma/seed.ts
// ─────────────────────────────────────────────────────────────────────────────
// EduSpark Seed Orchestrator
// Runs all seed modules in correct order. Safe to re-run.
// Usage: npx tsx prisma/seed.ts
// ─────────────────────────────────────────────────────────────────────────────

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { seedUsers } from "./seed/users";
import { seedCategories } from "./seed/categories";
import { seedCourses } from "./seed/courses";
import { seedEnrollments } from "./seed/enrollments";
import { boostCertificates } from "./seed/certificate-booster";
import { seedServices } from "./seed/services";
import { seedOrders } from "./seed/orders";
import { seedReviews } from "./seed/reviews";
import { seedChat } from "./seed/chat";
import { seedNotifications } from "./seed/notifications";
import { seedAiConversations } from "./seed/ai-conversations";
import { cleanupAll } from "./seed/cleanup";
import { seedBadges } from "./seed/badges";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const startTime = Date.now();

  console.log("\n" + "═".repeat(70));
  console.log("  🌱 EduSpark Comprehensive Seed");
  console.log("  " + new Date().toISOString());
  console.log("═".repeat(70));

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — check eduspark/.env.local");
  }

   // ── 0. Cleanup ─────────────────────────────────────────────────
  await cleanupAll(db);

  // ── 1. Users ──────────────────────────────────────────────────
  const users = await seedUsers(db);
    // ── Badges ────────────────────────────────────────────────────
  await seedBadges(db);

  // ── 2. Categories ─────────────────────────────────────────────
  const categories = await seedCategories(db);

  // ── 3. Courses ────────────────────────────────────────────────
  const courses = await seedCourses(
    db,
    { creators: users.creators, instructor: users.instructor },
    categories
  );

  // ── 4. Enrollments + Certificates ─────────────────────────────
  const enrollments = await seedEnrollments(
    db,
    {
      student: users.student,
      students: users.students,
      client: users.client,
    },
    { all: courses.all, withQuiz: courses.withQuiz }
  );

  // ── 5. Certificate Booster ────────────────────────────────────
  await boostCertificates(db, { withQuiz: courses.withQuiz });

  // ── 6. Services ───────────────────────────────────────────────
  const services = await seedServices(
    db,
    { instructor: users.instructor, creators: users.creators },
    categories
  );

  // ── 7. Orders + Projects + Milestones + Proposals ─────────────
  const orders = await seedOrders(
    db,
    {
      student: users.student,
      client: users.client,
      students: users.students,
      creators: users.creators,
      instructor: users.instructor,
    },
    { all: services.all }
  );

  // ── 8. Reviews ────────────────────────────────────────────────
  await seedReviews(
    db,
    { students: users.students, student: users.student, client: users.client },
    { all: courses.all }
  );

  // ── 9. Chat + Messages ────────────────────────────────────────
  await seedChat(
    db,
    {
      students: users.students,
      student: users.student,
      client: users.client,
      creators: users.creators,
      instructor: users.instructor,
    },
    { all: courses.all },
    { all: orders.projects }
  );

  // ── 10. Notifications ─────────────────────────────────────────
  await seedNotifications(db, { all: users.all });

  // ── 11. AI Conversations ──────────────────────────────────────
  await seedAiConversations(db, { all: users.all });

  // ── Final Summary ─────────────────────────────────────────────
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n" + "═".repeat(70));
  console.log("  ✅ SEED COMPLETED SUCCESSFULLY");
  console.log("═".repeat(70));
  console.log(`  ⏱️  Duration: ${duration}s`);
  console.log("");
  console.log("  📊 Final counts:");
  console.log(`     Users:          ${await db.user.count()}`);
  console.log(`     Categories:     ${await db.category.count()}`);
  console.log(`     Courses:        ${await db.course.count()}`);
  console.log(`     Lessons:        ${await db.lesson.count()}`);
  console.log(`     Enrollments:    ${await db.enrollment.count()}`);
  console.log(`     Certificates:   ${await db.certificate.count()}`);
  console.log(`     Services:       ${await db.service.count()}`);
  console.log(`     Orders:         ${await db.order.count()}`);
  console.log(`     Projects:       ${await db.project.count()}`);
  console.log(`     Milestones:     ${await db.milestone.count()}`);
  console.log(`     Reviews:        ${await db.review.count()}`);
  console.log(`     ChatRooms:      ${await db.chatRoom.count()}`);
  console.log(`     Messages:       ${await db.chatMessage.count()}`);
  console.log(`     Notifications:  ${await db.notification.count()}`);
  console.log(`     AI Convs:       ${await db.aiConversation.count()}`);
  console.log("");
  console.log("  🔑 Demo accounts (password: Password123!):");
  console.log("     👑 Creator:  sarah.creator@eduspark.dev");
  console.log("     🎓 Student:  ahmad.student@eduspark.dev");
  console.log("     💼 Client:   layla.client@eduspark.dev");
  console.log("     🛡️  Admin:    admin@eduspark.dev");
  console.log("");
  console.log("  🚀 Ready for demo!");
  console.log("═".repeat(70) + "\n");
}

main()
  .catch((error) => {
    console.error("\n" + "═".repeat(70));
    console.error("  ❌ SEED FAILED");
    console.error("═".repeat(70));
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });