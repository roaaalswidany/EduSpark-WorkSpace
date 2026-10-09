/* eslint-disable @typescript-eslint/no-unused-vars */
// eduspark/prisma/seed/courses.ts
import {
  CourseLevel,
  CourseStatus,
  type Category,
  type Course,
  type PrismaClient,
  type User,
} from "@prisma/client";
import {
  randomItem,
  randomInt,
  randomFloat,
  slugify,
  logHeader,
  logSuccess,
  logInfo,
} from "./helpers";
import { PLACEHOLDER_VIDEO_URL, PLACEHOLDER_THUMBNAILS } from "./config";

// ─── Course Specs ────────────────────────────────────────────────────────────

interface CourseSpec {
  title: string;
  description: string;
  language: "ar" | "en";
  level: CourseLevel;
  price: number;
  categorySlug: string;
  tags: string[];
  hasQuiz: boolean;
}

// 15 Arabic courses
const ARABIC_COURSES: CourseSpec[] = [
  {
    title: "تعلم Next.js من الصفر",
    description:
      "دورة عملية شاملة لتعلم إطار Next.js وبناء تطبيقات ويب حديثة باستخدام App Router و Server Components.",
    language: "ar",
    level: CourseLevel.INTERMEDIATE,
    price: 199.99,
    categorySlug: "web-development",
    tags: ["Next.js", "React", "TypeScript"],
    hasQuiz: true,
  },
  {
    title: "أساسيات React للمبتدئين",
    description:
      "ابدأ رحلتك في عالم React من المفاهيم الأولى حتى بناء تطبيقات تفاعلية كاملة.",
    language: "ar",
    level: CourseLevel.BEGINNER,
    price: 149.99,
    categorySlug: "web-development",
    tags: ["React", "JavaScript", "Frontend"],
    hasQuiz: true,
  },
  {
    title: "TypeScript بالعربي",
    description: "تعلم TypeScript من الأساسيات حتى المستوى المتقدم مع أمثلة عملية.",
    language: "ar",
    level: CourseLevel.INTERMEDIATE,
    price: 179.99,
    categorySlug: "web-development",
    tags: ["TypeScript", "JavaScript"],
    hasQuiz: true,
  },
  {
    title: "Tailwind CSS بالعربي",
    description: "احترف تصميم واجهات المستخدم الحديثة باستخدام Tailwind CSS.",
    language: "ar",
    level: CourseLevel.BEGINNER,
    price: 129.99,
    categorySlug: "ui-ux-design",
    tags: ["Tailwind", "CSS", "Design"],
    hasQuiz: false,
  },
  {
    title: "Node.js و Express",
    description: "بناء APIs احترافية باستخدام Node.js و Express من الصفر.",
    language: "ar",
    level: CourseLevel.INTERMEDIATE,
    price: 189.99,
    categorySlug: "web-development",
    tags: ["Node.js", "Express", "Backend"],
    hasQuiz: true,
  },
  {
    title: "قواعد بيانات PostgreSQL",
    description: "تعلم PostgreSQL من الأساسيات حتى الاستعلامات المتقدمة والتحسين.",
    language: "ar",
    level: CourseLevel.INTERMEDIATE,
    price: 169.99,
    categorySlug: "devops-cloud",
    tags: ["PostgreSQL", "SQL", "Database"],
    hasQuiz: true,
  },
  {
    title: "Prisma ORM بالعربي",
    description: "تعلم Prisma ORM وربط قواعد البيانات بتطبيقات TypeScript.",
    language: "ar",
    level: CourseLevel.INTERMEDIATE,
    price: 159.99,
    categorySlug: "web-development",
    tags: ["Prisma", "ORM", "TypeScript"],
    hasQuiz: true,
  },
  {
    title: "تعلم Python للبيانات",
    description: "ابدأ رحلتك في تحليل البيانات باستخدام Python من الصفر.",
    language: "ar",
    level: CourseLevel.BEGINNER,
    price: 139.99,
    categorySlug: "data-science",
    tags: ["Python", "Data Science"],
    hasQuiz: true,
  },
  {
    title: "تحليل البيانات مع Pandas",
    description: "احترف تحليل البيانات باستخدام مكتبة Pandas وأدواتها المتقدمة.",
    language: "ar",
    level: CourseLevel.INTERMEDIATE,
    price: 199.99,
    categorySlug: "data-science",
    tags: ["Pandas", "Python", "Analysis"],
    hasQuiz: true,
  },
  {
    title: "مقدمة في تعلم الآلة",
    description: "فهم أساسيات تعلم الآلة وتطبيقها باستخدام Python و scikit-learn.",
    language: "ar",
    level: CourseLevel.ADVANCED,
    price: 249.99,
    categorySlug: "artificial-intelligence",
    tags: ["Machine Learning", "AI", "Python"],
    hasQuiz: true,
  },
  {
    title: "أساسيات التسويق الرقمي",
    description: "تعلم استراتيجيات التسويق الرقمي الحديثة لبناء علامة تجارية ناجحة.",
    language: "ar",
    level: CourseLevel.BEGINNER,
    price: 119.99,
    categorySlug: "digital-marketing",
    tags: ["Marketing", "Digital"],
    hasQuiz: false,
  },
  {
    title: "إدارة وسائل التواصل الاجتماعي",
    description: "دورة عملية لإدارة حسابات التواصل الاجتماعي وبناء مجتمع متفاعل.",
    language: "ar",
    level: CourseLevel.INTERMEDIATE,
    price: 149.99,
    categorySlug: "digital-marketing",
    tags: ["Social Media", "Marketing"],
    hasQuiz: false,
  },
  {
    title: "ريادة الأعمال للمبتدئين",
    description: "خطوات عملية لتحويل فكرتك إلى شركة ناشئة ناجحة.",
    language: "ar",
    level: CourseLevel.BEGINNER,
    price: 169.99,
    categorySlug: "business-management",
    tags: ["Startup", "Business"],
    hasQuiz: false,
  },
  {
    title: "أساسيات التصوير الفوتوغرافي",
    description: "تعلم فن التصوير الفوتوغرافي من الصفر باستخدام الكاميرا أو الهاتف.",
    language: "ar",
    level: CourseLevel.BEGINNER,
    price: 129.99,
    categorySlug: "video-production",
    tags: ["Photography", "Camera"],
    hasQuiz: false,
  },
  {
    title: "الإنجليزية للأعمال",
    description: "طور مهاراتك في اللغة الإنجليزية للأعمال والاجتماعات المهنية.",
    language: "ar",
    level: CourseLevel.INTERMEDIATE,
    price: 179.99,
    categorySlug: "languages",
    tags: ["English", "Business"],
    hasQuiz: false,
  },
];

// 15 English courses
const ENGLISH_COURSES: CourseSpec[] = [
  {
    title: "Modern Web Development with Next.js",
    description:
      "Learn to build production-grade full-stack applications using Next.js, App Router, Server Components, and Server Actions.",
    language: "en",
    level: CourseLevel.INTERMEDIATE,
    price: 49.99,
    categorySlug: "web-development",
    tags: ["nextjs", "react", "typescript", "fullstack"],
    hasQuiz: true,
  },
  {
    title: "Advanced React Patterns",
    description:
      "Master advanced React patterns: compound components, render props, and custom hooks.",
    language: "en",
    level: CourseLevel.ADVANCED,
    price: 79.99,
    categorySlug: "web-development",
    tags: ["react", "patterns", "advanced"],
    hasQuiz: true,
  },
  {
    title: "TypeScript Deep Dive",
    description:
      "Master TypeScript's type system, generics, conditional types, and advanced patterns.",
    language: "en",
    level: CourseLevel.ADVANCED,
    price: 69.99,
    categorySlug: "web-development",
    tags: ["typescript", "types", "advanced"],
    hasQuiz: true,
  },
  {
    title: "Tailwind CSS Mastery",
    description:
      "Build beautiful, responsive UIs at lightning speed with Tailwind CSS.",
    language: "en",
    level: CourseLevel.INTERMEDIATE,
    price: 39.99,
    categorySlug: "ui-ux-design",
    tags: ["tailwind", "css", "design"],
    hasQuiz: false,
  },
  {
    title: "Node.js and Express Fundamentals",
    description:
      "Build robust REST APIs with Node.js, Express, and modern best practices.",
    language: "en",
    level: CourseLevel.INTERMEDIATE,
    price: 59.99,
    categorySlug: "web-development",
    tags: ["nodejs", "express", "api"],
    hasQuiz: true,
  },
  {
    title: "PostgreSQL for Developers",
    description:
      "Master PostgreSQL: schema design, advanced queries, indexes, and performance tuning.",
    language: "en",
    level: CourseLevel.INTERMEDIATE,
    price: 54.99,
    categorySlug: "devops-cloud",
    tags: ["postgresql", "sql", "database"],
    hasQuiz: true,
  },
  {
    title: "Prisma ORM in Practice",
    description:
      "Learn Prisma ORM end-to-end: schema design, migrations, relations, and type-safe queries.",
    language: "en",
    level: CourseLevel.INTERMEDIATE,
    price: 44.99,
    categorySlug: "web-development",
    tags: ["prisma", "orm", "typescript"],
    hasQuiz: true,
  },
  {
    title: "Python for Data Science",
    description:
      "Learn Python programming for data science with NumPy, Pandas, and Matplotlib.",
    language: "en",
    level: CourseLevel.BEGINNER,
    price: 44.99,
    categorySlug: "data-science",
    tags: ["python", "data", "numpy"],
    hasQuiz: true,
  },
  {
    title: "Data Analysis with Pandas",
    description:
      "Deep dive into Pandas for real-world data analysis: cleaning, aggregation, and visualization.",
    language: "en",
    level: CourseLevel.INTERMEDIATE,
    price: 64.99,
    categorySlug: "data-science",
    tags: ["pandas", "python", "analysis"],
    hasQuiz: true,
  },
  {
    title: "Introduction to Machine Learning",
    description:
      "Understand machine learning fundamentals with hands-on scikit-learn projects.",
    language: "en",
    level: CourseLevel.ADVANCED,
    price: 89.99,
    categorySlug: "artificial-intelligence",
    tags: ["machine-learning", "ai", "python"],
    hasQuiz: true,
  },
  {
    title: "Digital Marketing Essentials",
    description:
      "Master digital marketing: SEO, content strategy, paid ads, and analytics.",
    language: "en",
    level: CourseLevel.BEGINNER,
    price: 39.99,
    categorySlug: "digital-marketing",
    tags: ["marketing", "seo", "digital"],
    hasQuiz: false,
  },
  {
    title: "Social Media Management",
    description:
      "Grow and manage social media presence across platforms with proven strategies.",
    language: "en",
    level: CourseLevel.INTERMEDIATE,
    price: 49.99,
    categorySlug: "digital-marketing",
    tags: ["social-media", "marketing"],
    hasQuiz: false,
  },
  {
    title: "Startup Fundamentals",
    description:
      "From idea to launch: validating, building, and scaling your startup.",
    language: "en",
    level: CourseLevel.BEGINNER,
    price: 59.99,
    categorySlug: "business-management",
    tags: ["startup", "entrepreneurship"],
    hasQuiz: false,
  },
  {
    title: "Photography Basics",
    description:
      "Master the fundamentals of photography: composition, lighting, and editing.",
    language: "en",
    level: CourseLevel.BEGINNER,
    price: 44.99,
    categorySlug: "video-production",
    tags: ["photography", "camera"],
    hasQuiz: false,
  },
  {
    title: "Business English",
    description:
      "Master business English for meetings, emails, and professional presentations.",
    language: "en",
    level: CourseLevel.INTERMEDIATE,
    price: 54.99,
    categorySlug: "languages",
    tags: ["english", "business"],
    hasQuiz: false,
  },
];

// ─── Lesson + Section Templates ──────────────────────────────────────────────

const LESSON_TITLES = {
  ar: {
    BEGINNER: [
      "مقدمة عن الدورة",
      "المفاهيم الأساسية",
      "الإعداد والتثبيت",
      "أول تطبيق عملي",
      "التعامل مع الأخطاء",
      "أفضل الممارسات",
      "مشروع تطبيقي",
      "الخاتمة والخطوات التالية",
    ],
    INTERMEDIATE: [
      "مراجعة سريعة",
      "المفاهيم المتقدمة",
      "البنية والتنظيم",
      "أنماط التصميم",
      "التكامل مع الأنظمة الأخرى",
      "تحسين الأداء",
      "مشروع عملي متكامل",
      "الخاتمة",
    ],
    ADVANCED: [
      "نظرة عامة",
      "المفاهيم المتقدمة جداً",
      "دراسات حالة",
      "تحسين الأداء على نطاق واسع",
      "الأمان والحماية",
      "الاختبارات المتقدمة",
      "مشروع احترافي",
      "الخاتمة",
    ],
  },
  en: {
    BEGINNER: [
      "Introduction",
      "Core Concepts",
      "Setup & Installation",
      "Your First Application",
      "Handling Errors",
      "Best Practices",
      "Hands-on Project",
      "Wrap-up & Next Steps",
    ],
    INTERMEDIATE: [
      "Quick Review",
      "Advanced Concepts",
      "Architecture & Structure",
      "Design Patterns",
      "Integrations",
      "Performance Optimization",
      "Full Project",
      "Wrap-up",
    ],
    ADVANCED: [
      "Overview",
      "Advanced Concepts Deep Dive",
      "Case Studies",
      "Large-scale Performance",
      "Security & Hardening",
      "Advanced Testing",
      "Professional Project",
      "Wrap-up",
    ],
  },
} as const;

const SECTION_TITLES = {
  ar: {
    BEGINNER: ["البداية", "بناء الأساسيات", "المشروع التطبيقي"],
    INTERMEDIATE: ["مقدمة", "المفاهيم المتقدمة", "التطبيق العملي"],
    ADVANCED: ["التحضير", "المواضيع المتقدمة", "مشروع احترافي"],
  },
  en: {
    BEGINNER: ["Getting Started", "Building Foundations", "Hands-on Project"],
    INTERMEDIATE: ["Introduction", "Advanced Concepts", "Practical Application"],
    ADVANCED: ["Preparation", "Advanced Topics", "Capstone Project"],
  },
} as const;

// ─── Quiz Templates ──────────────────────────────────────────────────────────

interface QuizTemplate {
  ar: { text: string; options: string[]; correct: string; explanation: string }[];
  en: { text: string; options: string[]; correct: string; explanation: string }[];
}

function buildQuizQuestions(
  language: "ar" | "en",
  courseTitle: string,
  level: CourseLevel
): Array<{
  text: string;
  options: string[];
  correctOption: string;
  explanation: string;
  order: number;
}> {
  if (language === "ar") {
    return [
      {
        text: `ما هو الهدف الأساسي من دورة "${courseTitle}"؟`,
        options: [
          "بناء أساس قوي في المفاهيم الأساسية",
          "تعلم لغة برمجة واحدة فقط",
          "حفظ المعلومات دون تطبيق",
          "التركيز على النظرية فقط",
        ],
        correctOption: "بناء أساس قوي في المفاهيم الأساسية",
        explanation: "الدورة مصممة لبناء أساس متين مع التركيز على التطبيق العملي.",
        order: 1,
      },
      {
        text: "ما هو أفضل أسلوب للتعلم في هذه الدورة؟",
        options: [
          "قراءة المحتوى فقط",
          "مشاهدة الفيديوهات دون تطبيق",
          "التطبيق العملي الموازي مع المشاهدة",
          "الاعتماد على الحفظ",
        ],
        correctOption: "التطبيق العملي الموازي مع المشاهدة",
        explanation: "التطبيق العملي هو أساس التعلم الفعّال.",
        order: 2,
      },
      {
        text: "متى يجب عليك إعادة مشاهدة الدرس؟",
        options: [
          "لا داعي أبداً",
          "عند عدم فهم نقطة معينة",
          "فقط قبل الاختبار",
          "كل يوم",
        ],
        correctOption: "عند عدم فهم نقطة معينة",
        explanation: "إعادة المشاهدة عند الحاجة أداة تعلم قوية.",
        order: 3,
      },
      {
        text: "ما أهمية المشروع التطبيقي في نهاية الدورة؟",
        options: [
          "ليس مهم",
          "مجرد واجب",
          "يجمع كل ما تعلمته في تجربة واحدة",
          "لتضييع الوقت",
        ],
        correctOption: "يجمع كل ما تعلمته في تجربة واحدة",
        explanation: "المشروع النهائي يعزز الفهم ويجهزك للعمل الحقيقي.",
        order: 4,
      },
      {
        text: "ما النسبة المطلوبة لاجتياز اختبار الشهادة؟",
        options: ["50%", "60%", "70%", "80%"],
        correctOption: "80%",
        explanation: "النسبة المطلوبة لاجتياز الاختبار والحصول على الشهادة هي 80%.",
        order: 5,
      },
    ];
  }

  return [
    {
      text: `What is the primary goal of "${courseTitle}"?`,
      options: [
        "Build a solid foundation in core concepts",
        "Learn only one programming language",
        "Memorize without practice",
        "Focus only on theory",
      ],
      correctOption: "Build a solid foundation in core concepts",
      explanation:
        "The course is designed to build a strong foundation with hands-on practice.",
      order: 1,
    },
    {
      text: "What is the best learning approach for this course?",
      options: [
        "Reading only",
        "Watching videos without practicing",
        "Hands-on practice alongside watching",
        "Memorization",
      ],
      correctOption: "Hands-on practice alongside watching",
      explanation: "Hands-on practice is the foundation of effective learning.",
      order: 2,
    },
    {
      text: "When should you re-watch a lesson?",
      options: [
        "Never",
        "When you don't understand a specific point",
        "Only before the exam",
        "Every day",
      ],
      correctOption: "When you don't understand a specific point",
      explanation: "Re-watching when needed is a powerful learning tool.",
      order: 3,
    },
    {
      text: "Why is the final capstone project important?",
      options: [
        "It's not important",
        "It's just homework",
        "It combines everything you learned into one experience",
        "It's a waste of time",
      ],
      correctOption: "It combines everything you learned into one experience",
      explanation:
        "The capstone reinforces understanding and prepares you for real-world work.",
      order: 4,
    },
    {
      text: "What score is required to pass the certificate exam?",
      options: ["50%", "60%", "70%", "80%"],
      correctOption: "80%",
      explanation: "The passing score for the certificate exam is 80%.",
      order: 5,
    },
  ];
}

// ─── Main ────────────────────────────────────────────────────────────────────

export interface SeededCourses {
  all: Course[];
  withQuiz: Course[];
  arabic: Course[];
  english: Course[];
}

export async function seedCourses(
  db: PrismaClient,
  users: { creators: User[]; instructor: User },
  categories: Category[]
): Promise<SeededCourses> {
  logHeader("📚 Step 3: Courses");

  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));
  const allSpecs = [...ARABIC_COURSES, ...ENGLISH_COURSES];

  // Cleanup
  logInfo("Cleaning up existing courses...");
  await db.course.deleteMany({
    where: { slug: { in: allSpecs.map((s) => slugify(s.title)) } },
  });

  const createdCourses: Course[] = [];
  const courseWithQuiz: Course[] = [];

  // Distribute courses across creators
  const creators = [users.instructor, ...users.creators];

  for (let i = 0; i < allSpecs.length; i++) {
    const spec = allSpecs[i];
    const creator = creators[i % creators.length];
    const category = categoryBySlug.get(spec.categorySlug);
      // Arabic titles get clean English slugs (avoids URL encoding issues in
    // Next.js client-side navigation — fixes 404s from CareerPath timeline).
    const isArabicTitle = /[\u0600-\u06FF]/.test(spec.title);
    const slug = isArabicTitle
      ? `${spec.categorySlug}-ar-${i + 1}`
      : slugify(spec.title);
    const thumbnail =
      PLACEHOLDER_THUMBNAILS[i % PLACEHOLDER_THUMBNAILS.length];

    // Generate sections + lessons
    const sectionTitles = SECTION_TITLES[spec.language][spec.level];
    const lessonTitles = LESSON_TITLES[spec.language][spec.level];

    const sections = sectionTitles.map((sectionTitle, sIdx) => {
      const lessonCount = randomInt(3, 5);
      const lessonsForSection = Array.from({ length: lessonCount }, (_, lIdx) => {
        const titleIdx = (sIdx * 3 + lIdx) % lessonTitles.length;
        return {
          title: `${lessonTitles[titleIdx]}`,
          description:
            spec.language === "ar"
              ? `درس ${lIdx + 1} من القسم ${sIdx + 1}`
              : `Lesson ${lIdx + 1} from section ${sIdx + 1}`,
          videoUrl: PLACEHOLDER_VIDEO_URL,
          duration: randomInt(300, 1200),
          order: lIdx + 1,
          isFree: sIdx === 0 && lIdx === 0,
        };
      });

      return {
        title: sectionTitle,
        order: sIdx + 1,
        lessons: { create: lessonsForSection },
      };
    });

    // Create course with sections + lessons
    const course = await db.course.create({
      data: {
        title: spec.title,
        slug,
        description: spec.description,
        thumbnail,
        price: spec.price,
        level: spec.level,
        status: CourseStatus.PUBLISHED,
        language: spec.language,
        tags: spec.tags,
        totalRating: randomFloat(4.0, 5.0),
        ratingCount: randomInt(5, 80),
        creatorId: creator.id,
        categoryId: category?.id,
        sections: { create: sections },
      },
    });

    createdCourses.push(course);

    // Create quiz if needed
    if (spec.hasQuiz) {
      const questions = buildQuizQuestions(
        spec.language,
        spec.title,
        spec.level
      );

      await db.quiz.create({
        data: {
          title:
            spec.language === "ar"
              ? `اختبار ${spec.title}`
              : `${spec.title} Certification Quiz`,
          description:
            spec.language === "ar"
              ? "اختبار شامل يغطي المفاهيم الأساسية في الدورة."
              : "Comprehensive quiz covering the core concepts of the course.",
          passingScore: 80,
          timeLimit: 600,
          courseId: course.id,
          questions: { create: questions },
        },
      });

      courseWithQuiz.push(course);
    }

    logInfo(`  [${i + 1}/${allSpecs.length}] ${spec.title}`);
  }

  const arabic = createdCourses.filter((c) => c.language === "ar");
  const english = createdCourses.filter((c) => c.language === "en");

  logSuccess(`${createdCourses.length} courses created`);
  logInfo(`  🌍 Arabic:  ${arabic.length}`);
  logInfo(`  🌍 English: ${english.length}`);
  logInfo(`  📝 With quiz: ${courseWithQuiz.length}`);

  return {
    all: createdCourses,
    withQuiz: courseWithQuiz,
    arabic,
    english,
  };
}