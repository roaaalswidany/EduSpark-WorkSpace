import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local from eduspark root
config({ path: resolve(process.cwd(), ".env.local") });

import { PrismaClient, ChatRoomType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL is not defined. Check .env.local file.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

async function main() {
  console.log("🔍 Finding enrollments without course chat rooms...\n");

  // Get all distinct courses that have enrollments
  const enrollments = await db.enrollment.findMany({
    select: {
      courseId: true,
      userId: true,
    },
  });

  const courseIds = [...new Set(enrollments.map((e) => e.courseId))];
  console.log(`📚 Found ${courseIds.length} unique course(s) with enrollments\n`);

  for (const courseId of courseIds) {
    // Check if chat room exists
    let chatRoom = await db.chatRoom.findUnique({
      where: { courseId },
      select: { id: true },
    });

    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { title: true, creatorId: true },
    });

    if (!course) continue;

    if (chatRoom) {
      console.log(`✓ "${course.title}" — chat room already exists`);
    } else {
      // Create chat room
      chatRoom = await db.chatRoom.create({
        data: {
          type: ChatRoomType.COURSE,
          courseId,
        },
        select: { id: true },
      });
      console.log(`➕ "${course.title}" — created chat room`);
    }

    // Add creator as participant
    await db.chatRoomParticipant.createMany({
      data: [{ userId: course.creatorId, chatRoomId: chatRoom.id }],
      skipDuplicates: true,
    });

    // Add all enrolled students as participants
    const enrolledUsers = enrollments
      .filter((e) => e.courseId === courseId)
      .map((e) => e.userId);

    await db.chatRoomParticipant.createMany({
      data: enrolledUsers.map((uid) => ({
        userId: uid,
        chatRoomId: chatRoom!.id,
      })),
      skipDuplicates: true,
    });

    console.log(`   ↳ Added ${enrolledUsers.length} student(s) + 1 instructor`);
  }

  console.log("\n✅ Backfill complete!");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });