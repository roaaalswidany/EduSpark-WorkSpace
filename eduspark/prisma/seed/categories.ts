// eduspark/prisma/seed/02-categories.ts
import type { Category, PrismaClient } from "@prisma/client";
import { logHeader, logSuccess, logInfo } from "./helpers";

// ─── Category definitions ────────────────────────────────────────────────────

interface CategorySpec {
  name: string;
  slug: string;
  icon: string;
  description: string;
}

const CATEGORIES: CategorySpec[] = [
  // English categories (5)
  {
    name: "Web Development",
    slug: "web-development",
    icon: "code",
    description: "Frontend, backend, and full-stack web development.",
  },
  {
    name: "Data Science",
    slug: "data-science",
    icon: "bar-chart",
    description: "Data analysis, visualization, and machine learning.",
  },
  {
    name: "UI/UX Design",
    slug: "ui-ux-design",
    icon: "palette",
    description: "User interface and user experience design.",
  },
  {
    name: "Mobile Development",
    slug: "mobile-development",
    icon: "smartphone",
    description: "iOS and Android app development.",
  },
  {
    name: "DevOps & Cloud",
    slug: "devops-cloud",
    icon: "cloud",
    description: "CI/CD, cloud infrastructure, and containerization.",
  },
  // Arabic categories (5)
  {
    name: "الذكاء الاصطناعي",
    slug: "artificial-intelligence",
    icon: "brain",
    description: "تعلم الآلة والتعلم العميق ومعالجة اللغة الطبيعية.",
  },
  {
    name: "التسويق الرقمي",
    slug: "digital-marketing",
    icon: "megaphone",
    description: "التسويق عبر وسائل التواصل الاجتماعي وتحسين محركات البحث.",
  },
  {
    name: "إدارة الأعمال",
    slug: "business-management",
    icon: "briefcase",
    description: "إدارة المشاريع وريادة الأعمال والقيادة.",
  },
  {
    name: "التصوير والمونتاج",
    slug: "video-production",
    icon: "camera",
    description: "تصوير الفيديو والمونتاج الاحترافي.",
  },
  {
    name: "اللغات",
    slug: "languages",
    icon: "languages",
    description: "تعلم اللغات الأجنبية والمهارات اللغوية.",
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

export async function seedCategories(db: PrismaClient): Promise<Category[]> {
  logHeader("📂 Step 2: Categories");

  // Cleanup
  await db.category.deleteMany({
    where: { slug: { in: CATEGORIES.map((c) => c.slug) } },
  });

  // Create all
  const created = await Promise.all(
    CATEGORIES.map((spec) =>
      db.category.create({
        data: {
          name: spec.name,
          slug: spec.slug,
          description: spec.description,
          icon: spec.icon,
        },
      })
    )
  );

  logSuccess(`${created.length} categories created`);

  const arabic = created.filter((c) => /[\u0600-\u06FF]/.test(c.name));
  const english = created.filter((c) => !/[\u0600-\u06FF]/.test(c.name));

  logInfo(`  🌍 English: ${english.length}`);
  logInfo(`  🌍 Arabic:  ${arabic.length}`);

  return created;
}