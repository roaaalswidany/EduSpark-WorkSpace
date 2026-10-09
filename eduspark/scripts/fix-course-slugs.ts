// eduspark/scripts/fix-course-slugs.ts
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

const ARABIC_REGEX = /[\u0600-\u06FF]/;

async function main() {
  console.log("\n🔍 Finding courses with Arabic slugs...\n");

  const courses = await db.course.findMany({
    select: { id: true, title: true, slug: true, categoryId: true },
    orderBy: { createdAt: "asc" },
  });

  const arabicCourses = courses.filter((c) => ARABIC_REGEX.test(c.slug));
  console.log(`Found ${arabicCourses.length} courses with Arabic slugs\n`);

  if (arabicCourses.length === 0) {
    console.log("✅ Nothing to fix. All slugs are English.\n");
    return;
  }

  // Track counters per category
  const categoryCounters = new Map<string, number>();

  for (const course of arabicCourses) {
    const catKey = course.categoryId ?? "uncategorized";
    const n = (categoryCounters.get(catKey) ?? 0) + 1;
    categoryCounters.set(catKey, n);

    let categorySlug = "course";
    if (course.categoryId) {
      const cat = await db.category.findUnique({
        where: { id: course.categoryId },
        select: { slug: true },
      });
      if (cat) categorySlug = cat.slug;
    }

    let newSlug = `${categorySlug}-ar-${n}`;

    // Ensure uniqueness
    let conflict = await db.course.findUnique({
      where: { slug: newSlug },
      select: { id: true },
    });
    let attempt = 1;
    while (conflict && conflict.id !== course.id) {
      newSlug = `${categorySlug}-ar-${n}-${attempt++}`;
      conflict = await db.course.findUnique({
        where: { slug: newSlug },
        select: { id: true },
      });
    }

    await db.course.update({
      where: { id: course.id },
      data: { slug: newSlug },
    });

    console.log(`  ✓ ${course.title}`);
    console.log(`    ${course.slug}  →  ${newSlug}\n`);
  }

  // Final verification
  const remaining = await db.course.findMany({ select: { slug: true } });
  const stillArabic = remaining.filter((c) => ARABIC_REGEX.test(c.slug)).length;

  console.log("\n════════════════════════════════════════");
  console.log(`  ✅ Updated: ${arabicCourses.length} courses`);
  console.log(`  📊 Still Arabic: ${stillArabic}`);
  console.log("════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });