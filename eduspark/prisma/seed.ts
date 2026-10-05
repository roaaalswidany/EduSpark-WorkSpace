import { PrismaClient, Role, CourseLevel, CourseStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const db = new PrismaClient({ adapter });

// ─────────────────────────────────────────────────────────────────────────────
// Seed configuration — adjust freely without touching the logic below
// ─────────────────────────────────────────────────────────────────────────────

const SEED_PASSWORD_PLAIN = "Password123!";

const SEED_EMAILS = {
  instructor: "sarah.creator@eduspark.dev",
  student: "ahmad.student@eduspark.dev",
  client: "layla.client@eduspark.dev",
} as const;

const COURSE_SLUGS = {
  webDev: "modern-web-development-with-nextjs",
  dataScience: "data-analysis-with-python",
} as const;

const PLACEHOLDER_VIDEO_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

async function main(): Promise<void> {
  console.log("🌱 Seeding EduSpark database...\n");

  // ── Step 0: Clean slate ────────────────────────────────────────────────────
  // Deleting these 3 users cascades automatically (onDelete: Cascade is set
  // throughout the schema) to every Course, Section, Lesson, Quiz, Question,
  // Enrollment, LessonProgress, QuizAttempt, QuizAnswer, and Certificate that
  // belongs to them. This makes the script safely re-runnable.
  console.log("🧹 Cleaning up any previous seed data...");
  await db.user.deleteMany({
    where: { email: { in: Object.values(SEED_EMAILS) } },
  });

  // ── Step 1: Shared password hash ───────────────────────────────────────────
  // Cost factor 12 — identical to actions/auth/register.ts for consistency.
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD_PLAIN, 12);

  // ── Step 2: Users ───────────────────────────────────────────────────────────
  console.log("👤 Creating users...");

  const instructor = await db.user.create({
    data: {
      name: "Sarah Ahmad",
      email: SEED_EMAILS.instructor,
      password: hashedPassword,
      role: Role.CREATOR,
      headline: "Senior Full-Stack Instructor",
      bio: "10+ years building production web applications. Passionate about teaching modern JavaScript frameworks.",
      isActive: true,
    },
  });

  const student = await db.user.create({
    data: {
      name: "Ahmad Khaled",
      email: SEED_EMAILS.student,
      password: hashedPassword,
      role: Role.STUDENT,
      headline: "Aspiring Full-Stack Developer",
      isActive: true,
    },
  });

  const client = await db.user.create({
    data: {
      name: "Layla Hassan",
      email: SEED_EMAILS.client,
      password: hashedPassword,
      role: Role.STUDENT,
      headline: "Startup Founder",
      bio: "Looking to hire talented developers for my growing startup.",
      isActive: true,
    },
  });

  console.log(`   ✓ Instructor: ${instructor.email}`);
  console.log(`   ✓ Student:    ${student.email}`);
  console.log(`   ✓ Client:     ${client.email}`);

  // ── Step 3: Categories ──────────────────────────────────────────────────────
  console.log("\n📁 Creating categories...");

  const webDevCategory = await db.category.create({
    data: {
      name: "Web Development",
      slug: "web-development",
      description: "Frontend, backend, and full-stack web development courses.",
      icon: "code",
    },
  });

  const dataScienceCategory = await db.category.create({
    data: {
      name: "Data Science",
      slug: "data-science",
      description: "Data analysis, visualization, and machine learning courses.",
      icon: "bar-chart",
    },
  });

  // ── Step 4: Course #1 — Web Development (with Sections + Lessons) ─────────
  console.log("\n📚 Creating Course 1: Modern Web Development with Next.js...");

  const webDevCourse = await db.course.create({
    data: {
      title: "Modern Web Development with Next.js",
      slug: COURSE_SLUGS.webDev,
      description:
        "Learn to build production-grade full-stack applications using Next.js 14, the App Router, Server Components, and Server Actions. By the end of this course, you will be able to architect, build, and deploy a complete SaaS application from scratch.",
      thumbnail: null,
      price: 49.99,
      level: CourseLevel.INTERMEDIATE,
      status: CourseStatus.PUBLISHED,
      language: "en",
      tags: ["nextjs", "react", "typescript", "fullstack"],
      creatorId: instructor.id,
      categoryId: webDevCategory.id,
      sections: {
        create: [
          {
            title: "Getting Started",
            order: 1,
            lessons: {
              create: [
                {
                  title: "Course Introduction",
                  description: "Overview of what you'll build and learn in this course.",
                  videoUrl: PLACEHOLDER_VIDEO_URL,
                  duration: 320,
                  order: 1,
                  isFree: true,
                },
                {
                  title: "Setting Up Your Development Environment",
                  description: "Installing Node.js, VS Code, and the required tooling.",
                  videoUrl: PLACEHOLDER_VIDEO_URL,
                  duration: 480,
                  order: 2,
                  isFree: true,
                },
              ],
            },
          },
          {
            title: "Building Your First App",
            order: 2,
            lessons: {
              create: [
                {
                  title: "Creating Pages & Routes with the App Router",
                  description: "Understanding file-based routing in Next.js 14.",
                  videoUrl: PLACEHOLDER_VIDEO_URL,
                  duration: 600,
                  order: 1,
                  isFree: false,
                },
                {
                  title: "Working with Server Components",
                  description: "The difference between Server and Client Components, and when to use each.",
                  videoUrl: PLACEHOLDER_VIDEO_URL,
                  duration: 720,
                  order: 2,
                  isFree: false,
                },
              ],
            },
          },
        ],
      },
    },
  });

  // ── Step 5: Quiz + 5 Questions for Course #1 ───────────────────────────────
  console.log("📝 Creating certification quiz with 5 questions...");

  const quiz = await db.quiz.create({
    data: {
      title: "Next.js Fundamentals Certification Quiz",
      description:
        "Test your understanding of the core concepts covered in this course. A passing score of 80% or higher grants you a verified certificate and unlocks Creator privileges.",
      passingScore: 80,
      timeLimit: 600,
      courseId: webDevCourse.id,
      questions: {
        create: [
          {
            text: "Which routing system does Next.js 14's App Router use?",
            options: [
              "File-based routing",
              "XML configuration routing",
              "Manual route registration",
              "Database-driven routing",
            ],
            correctOption: "File-based routing",
            explanation:
              "The App Router uses the folder structure inside the app/ directory to define routes automatically.",
            order: 1,
          },
          {
            text: "What is the default rendering type for components inside the app/ directory?",
            options: ["Client Component", "Server Component", "Static HTML", "Web Worker"],
            correctOption: "Server Component",
            explanation:
              'Unless explicitly marked with "use client", every component in the App Router renders on the server by default.',
            order: 2,
          },
          {
            text: "Which directive must be added to a file to make it a Client Component?",
            options: ['"use server"', '"use client"', '"use effect"', '"use state"'],
            correctOption: '"use client"',
            explanation:
              'The "use client" directive at the top of a file opts that component (and its children) into client-side rendering and interactivity.',
            order: 3,
          },
          {
            text: "What is the primary purpose of a Server Action in Next.js?",
            options: [
              "Styling components with CSS",
              "Running mutations on the server directly from a Client or Server Component",
              "Rendering images",
              "Configuring the database connection",
            ],
            correctOption: "Running mutations on the server directly from a Client or Server Component",
            explanation:
              'Server Actions, marked with "use server", let you call server-side functions directly without manually building API routes.',
            order: 4,
          },
          {
            text: "Which Prisma Client method ensures multiple database writes succeed or fail together as a single atomic unit?",
            options: ["findMany()", "upsert()", "$transaction()", "connect()"],
            correctOption: "$transaction()",
            explanation:
              "$transaction() wraps multiple Prisma operations so that either all of them commit or none of them do, preventing partial writes.",
            order: 5,
          },
        ],
      },
    },
  });

  console.log(`   ✓ Quiz created with 5 questions (passing score: ${quiz.passingScore}%)`);

  // ── Step 6: Course #2 — Data Science (Sections + Lessons, no quiz) ────────
  console.log("\n📚 Creating Course 2: Data Analysis with Python...");

  const dataScienceCourse = await db.course.create({
    data: {
      title: "Data Analysis with Python",
      slug: COURSE_SLUGS.dataScience,
      description:
        "An introduction to data analysis using Python, Pandas, and Matplotlib. Designed for absolute beginners with no prior programming experience.",
      thumbnail: null,
      price: 39.99,
      level: CourseLevel.BEGINNER,
      status: CourseStatus.PUBLISHED,
      language: "en",
      tags: ["python", "pandas", "data-analysis"],
      creatorId: instructor.id,
      categoryId: dataScienceCategory.id,
      sections: {
        create: [
          {
            title: "Python Basics",
            order: 1,
            lessons: {
              create: [
                {
                  title: "Introduction to Python",
                  description: "Why Python is the language of choice for data analysis.",
                  videoUrl: PLACEHOLDER_VIDEO_URL,
                  duration: 360,
                  order: 1,
                  isFree: true,
                },
                {
                  title: "Data Types & Variables",
                  description: "Strings, numbers, lists, and dictionaries in Python.",
                  videoUrl: PLACEHOLDER_VIDEO_URL,
                  duration: 420,
                  order: 2,
                  isFree: false,
                },
              ],
            },
          },
          {
            title: "Working with Data",
            order: 2,
            lessons: {
              create: [
                {
                  title: "Introduction to Pandas",
                  description: "Loading and exploring datasets with the Pandas library.",
                  videoUrl: PLACEHOLDER_VIDEO_URL,
                  duration: 540,
                  order: 1,
                  isFree: false,
                },
                {
                  title: "Data Visualization Basics",
                  description: "Creating your first charts with Matplotlib.",
                  videoUrl: PLACEHOLDER_VIDEO_URL,
                  duration: 480,
                  order: 2,
                  isFree: false,
                },
              ],
            },
          },
        ],
      },
    },
  });

  // ── Step 7: Enroll the student in both courses ─────────────────────────────
  console.log("\n🎓 Enrolling student in both courses...");

  await db.enrollment.create({
    data: {
      userId: student.id,
      courseId: webDevCourse.id,
      paidAmount: webDevCourse.price,
    },
  });

  await db.enrollment.create({
    data: {
      userId: student.id,
      courseId: dataScienceCourse.id,
      paidAmount: dataScienceCourse.price,
    },
  });

  console.log("   ✓ Enrolled in: Modern Web Development with Next.js");
  console.log("   ✓ Enrolled in: Data Analysis with Python");

  // ── Done ─────────────────────────────────────────────────────────────────────
  console.log("\n✅ Seed completed successfully!\n");
  console.log("──────────────────────────────────────────────");
  console.log(" Test accounts (all share the same password)");
  console.log("──────────────────────────────────────────────");
  console.log(` Password for all accounts: ${SEED_PASSWORD_PLAIN}`);
  console.log("");
  console.log(` 🎨 Creator/Instructor : ${SEED_EMAILS.instructor}`);
  console.log(` 🎓 Student            : ${SEED_EMAILS.student}`);
  console.log(` 💼 Client             : ${SEED_EMAILS.client}`);
  console.log("──────────────────────────────────────────────\n");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });