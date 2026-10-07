// eduspark/prisma/seed/chat.ts
import {
  ChatRoomType,
  type ChatRoom,
  type Course,
  type PrismaClient,
  type Project,
  type User,
} from "@prisma/client";
import {
  randomInt,
  randomItem,
  hoursAgo,
  logHeader,
  logSuccess,
  logInfo,
} from "./helpers";

// ─── Message Pools ───────────────────────────────────────────────────────────

const ARABIC_MESSAGES = [
  "مرحباً، كيف يمكنني مساعدتك؟",
  "شكراً على التوضيح، سأبدأ العمل عليه الآن.",
  "هل يمكنك إرسال المتطلبات بشكل أوضح؟",
  "تم إنجاز الجزء الأول، سأرسل لك التحديثات قريباً.",
  "المشروع يسير بشكل جيد، أنا متحمس للنتيجة النهائية.",
  "لدي سؤال بخصوص التصميم، هل تفضل اللون الأزرق أم الأخضر؟",
  "سأحتاج يومين إضافيين لإنهاء هذه المرحلة.",
  "ممتاز! أحببت التقدم حتى الآن.",
  "هل يمكننا جدولة اجتماع لمناقشة التفاصيل؟",
  "سأرسل لك النسخة التجريبية اليوم.",
  "بانتظار ملاحظاتك بعد المراجعة.",
  "شكراً لتعاونك، لقد كان العمل معك ممتعاً.",
];

const ENGLISH_MESSAGES = [
  "Hello, how can I help you today?",
  "Thanks for clarifying. I'll start on it right away.",
  "Could you send the requirements in more detail?",
  "First part is done, I'll send you updates soon.",
  "The project is going well, excited about the outcome.",
  "Question about the design — do you prefer blue or green?",
  "I'll need two extra days to finish this phase.",
  "Great! I love the progress so far.",
  "Can we schedule a call to discuss details?",
  "I'll send you the demo version today.",
  "Looking forward to your feedback after review.",
  "Thanks for your collaboration, it's been a pleasure.",
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SeededChat {
  rooms: ChatRoom[];
  stats: {
    rooms: number;
    courseRooms: number;
    projectRooms: number;
    messages: number;
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function seedChat(
  db: PrismaClient,
  users: {
    students: User[];
    student: User;
    client: User;
    creators: User[];
    instructor: User;
  },
  courses: { all: Course[] },
  projects: { all: Project[] }
): Promise<SeededChat> {
  logHeader("💬 Step 9: Chat Rooms + Messages");

  // Cleanup (cascade covers messages + participants)
  await db.chatRoom.deleteMany({});

  const createdRooms: ChatRoom[] = [];
  let totalMessages = 0;
  let courseRooms = 0;
  let projectRooms = 0;

  // ─────────────────────────────────────────────────────────────
  // Course Chat Rooms (10 rooms)
  // ─────────────────────────────────────────────────────────────
  logInfo("Creating course chat rooms...");

  const courseSample = courses.all.slice(0, 10);
  const allStudents = [users.student, users.client, ...users.students];

  for (const course of courseSample) {
    const room = await db.chatRoom.create({
      data: {
        type: ChatRoomType.COURSE,
        courseId: course.id,
      },
    });
    createdRooms.push(room);
    courseRooms++;

    // Participants: course creator + 5-10 random students
    const participantCount = randomInt(5, 10);
    const participants = [
      course.creatorId,
      ...allStudents
        .filter((s) => s.id !== course.creatorId)
        .slice(0, participantCount)
        .map((s) => s.id),
    ];

    await db.chatRoomParticipant.createMany({
      data: participants.map((userId) => ({
        userId,
        chatRoomId: room.id,
      })),
      skipDuplicates: true,
    });

    // Messages (15-30 per room)
    const messageCount = randomInt(15, 30);
    const isArabic = course.language === "ar";
    const messagePool = isArabic ? ARABIC_MESSAGES : ENGLISH_MESSAGES;

    const messagesData = Array.from({ length: messageCount }, (_, i) => {
      const senderId = participants[i % participants.length];
      return {
        chatRoomId: room.id,
        senderId,
        content: randomItem(messagePool),
        createdAt: hoursAgo(randomInt(1, 500)),
      };
    });

    await db.chatMessage.createMany({ data: messagesData });
    totalMessages += messageCount;
  }

  // ─────────────────────────────────────────────────────────────
  // Project Chat Rooms (15 rooms)
  // ─────────────────────────────────────────────────────────────
  logInfo("Creating project chat rooms...");

  const projectSample = projects.all
    .filter((p) => p.creatorId && p.status !== "OPEN")
    .slice(0, 15);

  for (const project of projectSample) {
    if (!project.creatorId) continue;

    const room = await db.chatRoom.create({
      data: {
        type: ChatRoomType.PROJECT,
        projectId: project.id,
      },
    });
    createdRooms.push(room);
    projectRooms++;

    // Participants: client + creator
    await db.chatRoomParticipant.createMany({
      data: [
        { userId: project.clientId, chatRoomId: room.id },
        { userId: project.creatorId, chatRoomId: room.id },
      ],
      skipDuplicates: true,
    });

    // Messages (20-35 per room)
    const messageCount = randomInt(20, 35);
    const isArabicProject = /[\u0600-\u06FF]/.test(project.title);
    const messagePool = isArabicProject ? ARABIC_MESSAGES : ENGLISH_MESSAGES;

    const senderIds = [project.clientId, project.creatorId];

    const messagesData = Array.from({ length: messageCount }, (_, i) => ({
      chatRoomId: room.id,
      senderId: senderIds[i % 2],
      content: randomItem(messagePool),
      createdAt: hoursAgo(randomInt(1, 400)),
    }));

    await db.chatMessage.createMany({ data: messagesData });
    totalMessages += messageCount;
  }

  logSuccess(`${createdRooms.length} chat rooms created`);
  logInfo(`  📚 Course rooms:  ${courseRooms}`);
  logInfo(`  💼 Project rooms: ${projectRooms}`);
  logInfo(`  💬 Total messages: ${totalMessages}`);

  return {
    rooms: createdRooms,
    stats: {
      rooms: createdRooms.length,
      courseRooms,
      projectRooms,
      messages: totalMessages,
    },
  };
}