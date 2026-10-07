// eduspark/prisma/seed/01-users.ts
import { Role, type User, type PrismaClient } from "@prisma/client";
import {
  SEED_COUNTS,
  TEST_ACCOUNTS,
  TEST_ACCOUNT_NAMES,
  SEED_PASSWORD_PLAIN,
  PROTECTED_EMAILS,
  PLACEHOLDER_AVATARS,
} from "./config";
import {
  hashPassword,
  randomItem,
  randomDateWithinPastDays,
  logHeader,
  logSuccess,
  logInfo,
} from "./helpers";

// ─── Name pools ──────────────────────────────────────────────────────────────

const ARABIC_NAMES = [
  "خالد المصري", "نور الدين", "يوسف عبد الله", "لينا محمد", "مايا حسين",
  "زيد الجابري", "رنا العلي", "عمر الفاروق", "سلمى التميمي", "مريم الزهراني",
  "عبد الرحمن الشامي", "هبة الراشد", "فاطمة الأحمد", "كريم النجار", "دينا الخوري",
  "طارق السيد", "هدى المالكي", "باسم الحاج", "ريم الصايغ", "أنس الكويتي",
  "جمانة العتيبي", "مالك الدرعي", "شذى الفهد", "بلال القاسم", "غادة الرشيدي",
  "مهند العباسي", "أسماء الجابري", "سامي الحلبي", "ليان الشهري", "وائل الطرابلسي",
  "رغد الدوسري", "فادي معلوف", "نادين حداد", "سامر القاسمي", "يارا الأشقر",
  "زياد العبد", "دانة الخالدي", "محمد الفيصل", "رهف السلطان", "عدنان مرعي",
] as const;

const ENGLISH_NAMES = [
  "James Carter", "Emma Wilson", "Michael Chen", "Sophia Rodriguez", "David Kim",
  "Olivia Brown", "Daniel Martinez", "Ava Thompson", "Ethan Anderson", "Mia Taylor",
  "Lucas Garcia", "Isabella Lewis", "Noah Walker", "Charlotte Hall", "Liam Young",
  "Amelia King", "Mason Wright", "Harper Lopez", "Logan Hill", "Evelyn Scott",
  "Jacob Green", "Abigail Adams", "William Baker", "Emily Nelson", "Benjamin Carter",
  "Elizabeth Mitchell", "Henry Perez", "Sofia Roberts", "Alexander Turner", "Victoria Phillips",
  "Nathan Collins", "Grace Stewart", "Ryan Sanchez", "Chloe Morris", "Dylan Rogers",
  "Lily Reed", "Owen Cook", "Zoe Morgan", "Caleb Bell", "Nora Murphy",
] as const;

const ARABIC_HEADLINES = [
  "مطور ويب شغوف",
  "مصمم واجهات مستخدم",
  "مهندس برمجيات",
  "مطور تطبيقات جوال",
  "محلل بيانات",
  "مطور Full-Stack",
] as const;

const ENGLISH_HEADLINES = [
  "Full-Stack Developer",
  "UI/UX Designer",
  "Software Engineer",
  "Mobile App Developer",
  "Data Analyst",
  "DevOps Engineer",
] as const;

const ARABIC_BIOS = [
  "شغوف بتعلم التقنيات الحديثة وبناء مشاريع مفيدة.",
  "أسعى لتطوير مهاراتي في مجال البرمجة والتصميم.",
  "مهتم بتحليل البيانات واتخاذ القرارات المبنية على الأرقام.",
  "أعمل على بناء منتجات رقمية تخدم المستخدم العربي.",
] as const;

const ENGLISH_BIOS = [
  "Passionate about learning modern technologies and building useful projects.",
  "Working on improving my programming and design skills.",
  "Interested in data analysis and data-driven decision making.",
  "Building digital products that solve real problems.",
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emailFromName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "") + "@eduspark.dev";
}

async function batchCreate<T, R>(
  items: T[],
  batchSize: number,
  createFn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item, j) => createFn(item, i + j))
    );
    results.push(...batchResults);
  }
  return results;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SeededUsers {
  instructor: User;
  student: User;
  client: User;
  admin: User;
  students: User[];
  creators: User[];
  all: User[];
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function seedUsers(db: PrismaClient): Promise<SeededUsers> {
  logHeader("👥 Step 1: Users");

  // ── Safety check ──────────────────────────────────────────────────
  if (process.env.NODE_ENV === "production" && !process.env.FORCE_SEED) {
    throw new Error(
      "Refusing to seed in production. Set FORCE_SEED=1 to override."
    );
  }

  // ── Cleanup: delete ALL users except protected accounts ──────────
  // Cascades to enrollments, courses, services, orders, etc.
  logInfo("Cleaning up existing users (except protected)...");
  const deleted = await db.user.deleteMany({
    where: { email: { notIn: [...PROTECTED_EMAILS] } },
  });
  logInfo(`  Deleted ${deleted.count} users`);

  // ── Shared password ──────────────────────────────────────────────
  const hashedPassword = await hashPassword(SEED_PASSWORD_PLAIN);

  // ── Test/demo accounts ───────────────────────────────────────────
  const instructor = await db.user.create({
    data: {
      name: TEST_ACCOUNT_NAMES.instructor,
      email: TEST_ACCOUNTS.instructor,
      password: hashedPassword,
      role: Role.CREATOR,
      headline: "Senior Full-Stack Instructor",
      bio: "10+ years building production web applications. Passionate about teaching modern JavaScript frameworks.",
      image: PLACEHOLDER_AVATARS[0],
      isActive: true,
    },
  });

  const student = await db.user.create({
    data: {
      name: TEST_ACCOUNT_NAMES.student,
      email: TEST_ACCOUNTS.student,
      password: hashedPassword,
      role: Role.STUDENT,
      headline: "Aspiring Full-Stack Developer",
      image: PLACEHOLDER_AVATARS[1],
      isActive: true,
    },
  });

  const client = await db.user.create({
    data: {
      name: TEST_ACCOUNT_NAMES.client,
      email: TEST_ACCOUNTS.client,
      password: hashedPassword,
      role: Role.STUDENT,
      headline: "Startup Founder",
      bio: "Looking to hire talented developers for my growing startup.",
      image: PLACEHOLDER_AVATARS[2],
      isActive: true,
    },
  });

  const admin = await db.user.create({
    data: {
      name: TEST_ACCOUNT_NAMES.admin,
      email: TEST_ACCOUNTS.admin,
      password: hashedPassword,
      role: Role.ADMIN,
      headline: "Platform Administrator",
      image: PLACEHOLDER_AVATARS[3],
      isActive: true,
    },
  });

  logSuccess(`Test accounts ready (password: ${SEED_PASSWORD_PLAIN})`);
  logInfo(`  👑 ${instructor.email}`);
  logInfo(`  🎓 ${student.email}`);
  logInfo(`  💼 ${client.email}`);
  logInfo(`  🛡️  ${admin.email}`);

  // ── Prepare generated user specs ─────────────────────────────────
  const total = SEED_COUNTS.students + SEED_COUNTS.creators + SEED_COUNTS.mixed;
  const half = Math.floor(total / 2);

  const specs: Array<{
    name: string;
    language: "ar" | "en";
    role: Role;
  }> = [];

  for (let i = 0; i < total; i++) {
    const language: "ar" | "en" = i < half ? "ar" : "en";

    let role: Role = Role.STUDENT;
    if (i >= SEED_COUNTS.students && i < SEED_COUNTS.students + SEED_COUNTS.creators) {
      role = Role.CREATOR;
    } else if (i >= SEED_COUNTS.students + SEED_COUNTS.creators) {
      role = Role.CREATOR; // mixed users default to CREATOR
    }

    const name = language === "ar"
      ? ARABIC_NAMES[i % ARABIC_NAMES.length]
      : ENGLISH_NAMES[(i - half) % ENGLISH_NAMES.length];

    specs.push({ name, language, role });
  }

  // ── Create generated users in batches of 10 ──────────────────────
  logInfo(`Creating ${specs.length} generated users...`);

  const generatedUsers = await batchCreate(specs, 10, async (spec, idx) => {
    const headline = spec.language === "ar"
      ? randomItem(ARABIC_HEADLINES)
      : randomItem(ENGLISH_HEADLINES);
    const bio = spec.language === "ar"
      ? randomItem(ARABIC_BIOS)
      : randomItem(ENGLISH_BIOS);

    const email = spec.language === "ar"
      ? `arabic.user.${idx + 100}@eduspark.dev`
      : emailFromName(spec.name);

    return db.user.create({
      data: {
        name: spec.name,
        email,
        password: hashedPassword,
        role: spec.role,
        headline,
        bio,
        image: PLACEHOLDER_AVATARS[idx % PLACEHOLDER_AVATARS.length],
        isActive: true,
        createdAt: randomDateWithinPastDays(180),
      },
    });
  });

  const students = generatedUsers.filter((u) => u.role === Role.STUDENT);
  const creators = generatedUsers.filter((u) => u.role === Role.CREATOR);

  logSuccess(`${generatedUsers.length} users generated`);
  logInfo(`  🎓 Students: ${students.length}`);
  logInfo(`  ✨ Creators: ${creators.length}`);

  return {
    instructor,
    student,
    client,
    admin,
    students,
    creators,
    all: [instructor, student, client, admin, ...generatedUsers],
  };
}