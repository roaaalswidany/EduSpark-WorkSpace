/* eslint-disable @typescript-eslint/no-unused-vars */
// eduspark/prisma/seed/services.ts
import {
  ServiceStatus,
  type Category,
  type PrismaClient,
  type Service,
  type User,
} from "@prisma/client";
import {
  slugify,
  randomInt,
  randomFloat,
  randomItem,
  daysAgo,
  logHeader,
  logSuccess,
  logInfo,
} from "./helpers";
import { PLACEHOLDER_THUMBNAILS } from "./config";

// ─── Service Specs ───────────────────────────────────────────────────────────

interface ServiceSpec {
  title: string;
  description: string;
  language: "ar" | "en";
  price: number;
  deliveryDays: number;
  revisions: number;
  categorySlug: string;
  tags: string[];
  portfolioLinks: string[];
}

// 20 Arabic services
const ARABIC_SERVICES: ServiceSpec[] = [
  {
    title: "سأبني لك تطبيق ويب متكامل باستخدام Next.js",
    description:
      "تطبيق ويب احترافي كامل باستخدام Next.js و TypeScript، مع لوحة تحكم، مصادقة، وقاعدة بيانات. يشمل النشر على Vercel.",
    language: "ar",
    price: 1500,
    deliveryDays: 14,
    revisions: 3,
    categorySlug: "web-development",
    tags: ["Next.js", "TypeScript", "Full-Stack"],
    portfolioLinks: [
      "https://github.com/example/nextjs-project",
      "https://example.com/portfolio",
    ],
  },
  {
    title: "سأصمم لك موقعاً احترافياً بتقنية React",
    description:
      "تصميم وتطوير موقع ويب حديث باستخدام React و Tailwind CSS، متجاوب مع جميع الأجهزة.",
    language: "ar",
    price: 1200,
    deliveryDays: 10,
    revisions: 3,
    categorySlug: "web-development",
    tags: ["React", "Tailwind", "UI"],
    portfolioLinks: ["https://example.com/react-portfolio"],
  },
  {
    title: "سأطور API احترافي باستخدام Node.js و Express",
    description:
      "تطوير REST API آمن وسريع باستخدام Node.js و Express و PostgreSQL، مع توثيق كامل.",
    language: "ar",
    price: 900,
    deliveryDays: 7,
    revisions: 2,
    categorySlug: "web-development",
    tags: ["Node.js", "Express", "API"],
    portfolioLinks: [],
  },
  {
    title: "سأصمم شعاراً احترافياً لعلامتك التجارية",
    description:
      "تصميم شعار مبتكر واحترافي يعكس هوية علامتك التجارية، مع 3 نسخ مختلفة وملفات جاهزة للطباعة.",
    language: "ar",
    price: 400,
    deliveryDays: 5,
    revisions: 5,
    categorySlug: "ui-ux-design",
    tags: ["تصميم", "شعار", "هوية"],
    portfolioLinks: ["https://dribbble.com/example"],
  },
  {
    title: "سأصمم واجهة تطبيق جوال كاملة",
    description:
      "تصميم UI/UX كامل لتطبيق جوال (iOS + Android) باستخدام Figma، مع wireframes، mockups، وprototype تفاعلي.",
    language: "ar",
    price: 1800,
    deliveryDays: 14,
    revisions: 3,
    categorySlug: "ui-ux-design",
    tags: ["UI/UX", "Figma", "Mobile"],
    portfolioLinks: ["https://behance.net/example"],
  },
  {
    title: "سأحلل بياناتك وأقدم تقريراً احترافياً",
    description:
      "تحليل شامل لبياناتك باستخدام Python و Pandas، مع تقرير مفصل ورسوم بيانية توضيحية.",
    language: "ar",
    price: 700,
    deliveryDays: 7,
    revisions: 2,
    categorySlug: "data-science",
    tags: ["Python", "Pandas", "تحليل بيانات"],
    portfolioLinks: [],
  },
  {
    title: "سأبني لك نموذج تعلم آلة مخصص",
    description:
      "بناء نموذج تعلم آلة مخصص لمشروعك باستخدام Python و scikit-learn، مع تحسين الأداء وتوثيق كامل.",
    language: "ar",
    price: 2500,
    deliveryDays: 21,
    revisions: 2,
    categorySlug: "artificial-intelligence",
    tags: ["AI", "Machine Learning", "Python"],
    portfolioLinks: [],
  },
  {
    title: "سأدير حساباتك على وسائل التواصل الاجتماعي",
    description:
      "إدارة احترافية لحساباتك على Instagram و Facebook و Twitter، مع جدول محتوى شهري وتقارير أسبوعية.",
    language: "ar",
    price: 800,
    deliveryDays: 30,
    revisions: 0,
    categorySlug: "digital-marketing",
    tags: ["Social Media", "Marketing"],
    portfolioLinks: [],
  },
  {
    title: "سأكتب لك محتوى تسويقي إبداعي",
    description:
      "كتابة محتوى تسويقي احترافي لموقعك أو حملاتك الإعلانية، مع مراعاة SEO وجذب الجمهور المستهدف.",
    language: "ar",
    price: 350,
    deliveryDays: 5,
    revisions: 3,
    categorySlug: "digital-marketing",
    tags: ["كتابة", "محتوى", "SEO"],
    portfolioLinks: [],
  },
  {
    title: "سأطور تطبيق جوال باستخدام React Native",
    description:
      "تطوير تطبيق جوال كامل (iOS + Android) باستخدام React Native، مع ربط API ولوحة تحكم.",
    language: "ar",
    price: 2200,
    deliveryDays: 21,
    revisions: 3,
    categorySlug: "mobile-development",
    tags: ["React Native", "Mobile", "iOS", "Android"],
    portfolioLinks: [],
  },
  {
    title: "سأنشئ متجراً إلكترونياً كاملاً لك",
    description:
      "إنشاء متجر إلكتروني احترافي باستخدام Shopify أو WooCommerce، مع تصميم مخصص وربط بوابات الدفع.",
    language: "ar",
    price: 1600,
    deliveryDays: 14,
    revisions: 3,
    categorySlug: "web-development",
    tags: ["E-commerce", "Shopify"],
    portfolioLinks: [],
  },
  {
    title: "سأصمم عرض تقديمي احترافي",
    description:
      "تصميم عرض تقديمي (Presentation) احترافي وجذاب باستخدام PowerPoint أو Keynote، مناسب للاجتماعات والمناقشات.",
    language: "ar",
    price: 300,
    deliveryDays: 3,
    revisions: 3,
    categorySlug: "business-management",
    tags: ["تصميم", "عرض تقديمي"],
    portfolioLinks: [],
  },
  {
    title: "سأكتب خطة عمل شاملة لمشروعك",
    description:
      "كتابة خطة عمل احترافية وشاملة لمشروعك، تتضمن تحليل السوق، الخطة المالية، واستراتيجية التسويق.",
    language: "ar",
    price: 500,
    deliveryDays: 7,
    revisions: 3,
    categorySlug: "business-management",
    tags: ["خطة عمل", "Business Plan"],
    portfolioLinks: [],
  },
  {
    title: "سأصور لك منتجاتك بجودة احترافية",
    description:
      "تصوير منتجات احترافي مع تحرير كامل للصور وخلفيات بيضاء جاهزة للمتاجر الإلكترونية.",
    language: "ar",
    price: 600,
    deliveryDays: 5,
    revisions: 2,
    categorySlug: "video-production",
    tags: ["تصوير", "منتجات", "Photography"],
    portfolioLinks: [],
  },
  {
    title: "سأمنتج لك فيديو إعلاني احترافي",
    description:
      "إنتاج فيديو إعلاني كامل (كتابة سكريبت، تصوير، مونتاج) لعلامتك التجارية أو منتجك.",
    language: "ar",
    price: 1400,
    deliveryDays: 10,
    revisions: 3,
    categorySlug: "video-production",
    tags: ["فيديو", "مونتاج", "إعلان"],
    portfolioLinks: [],
  },
  {
    title: "سأدرس لك اللغة الإنجليزية محادثة",
    description:
      "دروس خصوصية في اللغة الإنجليزية للمحادثة، مع خطة مخصصة حسب مستواك وأهدافك.",
    language: "ar",
    price: 250,
    deliveryDays: 30,
    revisions: 0,
    categorySlug: "languages",
    tags: ["English", "محادثة", "لغة"],
    portfolioLinks: [],
  },
  {
    title: "سأقوم بترجمة احترافية عربي-إنجليزي",
    description:
      "ترجمة احترافية دقيقة من العربية إلى الإنجليزية (أو العكس)، مع مراعاة السياق والمصطلحات التقنية.",
    language: "ar",
    price: 200,
    deliveryDays: 3,
    revisions: 2,
    categorySlug: "languages",
    tags: ["ترجمة", "Translation"],
    portfolioLinks: [],
  },
  {
    title: "سأحسّن أداء موقعك وأزيد سرعته",
    description:
      "تحليل شامل لموقعك وتحسين الأداء (Lighthouse Score)، تقليل حجم الصفحة، وتحسين Core Web Vitals.",
    language: "ar",
    price: 750,
    deliveryDays: 5,
    revisions: 2,
    categorySlug: "devops-cloud",
    tags: ["Performance", "Optimization"],
    portfolioLinks: [],
  },
  {
    title: "سأنشر تطبيقك على السحابة (AWS / Vercel)",
    description:
      "إعداد بنية تحتية احترافية على السحابة، مع CI/CD، متابعة، ونسخ احتياطي تلقائي.",
    language: "ar",
    price: 1100,
    deliveryDays: 7,
    revisions: 2,
    categorySlug: "devops-cloud",
    tags: ["DevOps", "AWS", "Cloud"],
    portfolioLinks: [],
  },
  {
    title: "سأراجع كودك وأقدم ملاحظات احترافية",
    description:
      "مراجعة شاملة للكود (Code Review) مع ملاحظات مفصلة حول الأمان، الأداء، وأفضل الممارسات.",
    language: "ar",
    price: 450,
    deliveryDays: 4,
    revisions: 1,
    categorySlug: "web-development",
    tags: ["Code Review", "Quality"],
    portfolioLinks: [],
  },
];

// 20 English services
const ENGLISH_SERVICES: ServiceSpec[] = [
  {
    title: "I will build a full-stack SaaS application with Next.js",
    description:
      "Production-grade SaaS web app using Next.js, TypeScript, Prisma, and PostgreSQL. Includes dashboard, auth, and database. Deployed to Vercel.",
    language: "en",
    price: 1500,
    deliveryDays: 14,
    revisions: 3,
    categorySlug: "web-development",
    tags: ["nextjs", "typescript", "fullstack", "saas"],
    portfolioLinks: ["https://github.com/example/saas"],
  },
  {
    title: "I will design a modern responsive website with React",
    description:
      "Modern responsive website built with React and Tailwind CSS. Pixel-perfect, mobile-first, and performant.",
    language: "en",
    price: 1200,
    deliveryDays: 10,
    revisions: 3,
    categorySlug: "web-development",
    tags: ["react", "tailwind", "responsive"],
    portfolioLinks: ["https://example.com/react-portfolio"],
  },
  {
    title: "I will develop a production-ready REST API",
    description:
      "Secure, scalable REST API with Node.js, Express, and PostgreSQL. Includes OpenAPI documentation and tests.",
    language: "en",
    price: 900,
    deliveryDays: 7,
    revisions: 2,
    categorySlug: "web-development",
    tags: ["nodejs", "express", "api", "rest"],
    portfolioLinks: [],
  },
  {
    title: "I will design a professional logo for your brand",
    description:
      "Unique and memorable logo design reflecting your brand identity. Includes 3 variations and print-ready files.",
    language: "en",
    price: 400,
    deliveryDays: 5,
    revisions: 5,
    categorySlug: "ui-ux-design",
    tags: ["logo", "branding", "design"],
    portfolioLinks: ["https://dribbble.com/example"],
  },
  {
    title: "I will design a complete mobile app UI/UX",
    description:
      "Full UI/UX design for mobile apps (iOS + Android) in Figma. Wireframes, mockups, interactive prototype included.",
    language: "en",
    price: 1800,
    deliveryDays: 14,
    revisions: 3,
    categorySlug: "ui-ux-design",
    tags: ["ui", "ux", "figma", "mobile"],
    portfolioLinks: ["https://behance.net/example"],
  },
  {
    title: "I will analyze your data and deliver a professional report",
    description:
      "Comprehensive data analysis with Python and Pandas. Detailed report with charts and actionable insights.",
    language: "en",
    price: 700,
    deliveryDays: 7,
    revisions: 2,
    categorySlug: "data-science",
    tags: ["python", "pandas", "data-analysis"],
    portfolioLinks: [],
  },
  {
    title: "I will build a custom machine learning model",
    description:
      "Custom ML model for your project using Python and scikit-learn. Includes optimization and documentation.",
    language: "en",
    price: 2500,
    deliveryDays: 21,
    revisions: 2,
    categorySlug: "artificial-intelligence",
    tags: ["ai", "machine-learning", "python"],
    portfolioLinks: [],
  },
  {
    title: "I will manage your social media accounts",
    description:
      "Professional management of Instagram, Facebook, and Twitter. Monthly content calendar and weekly reports.",
    language: "en",
    price: 800,
    deliveryDays: 30,
    revisions: 0,
    categorySlug: "digital-marketing",
    tags: ["social-media", "marketing"],
    portfolioLinks: [],
  },
  {
    title: "I will write creative marketing copy for your brand",
    description:
      "Professional marketing copy for your website or ad campaigns. SEO-optimized and audience-focused.",
    language: "en",
    price: 350,
    deliveryDays: 5,
    revisions: 3,
    categorySlug: "digital-marketing",
    tags: ["copywriting", "content", "seo"],
    portfolioLinks: [],
  },
  {
    title: "I will build a mobile app with React Native",
    description:
      "Full cross-platform mobile app (iOS + Android) with React Native. Includes API integration and admin panel.",
    language: "en",
    price: 2200,
    deliveryDays: 21,
    revisions: 3,
    categorySlug: "mobile-development",
    tags: ["react-native", "mobile", "ios", "android"],
    portfolioLinks: [],
  },
  {
    title: "I will create a complete e-commerce store for you",
    description:
      "Professional e-commerce store on Shopify or WooCommerce with custom design and payment gateway integration.",
    language: "en",
    price: 1600,
    deliveryDays: 14,
    revisions: 3,
    categorySlug: "web-development",
    tags: ["ecommerce", "shopify"],
    portfolioLinks: [],
  },
  {
    title: "I will design a professional presentation deck",
    description:
      "Stunning, professional presentation deck in PowerPoint or Keynote. Perfect for meetings and pitches.",
    language: "en",
    price: 300,
    deliveryDays: 3,
    revisions: 3,
    categorySlug: "business-management",
    tags: ["presentation", "design"],
    portfolioLinks: [],
  },
  {
    title: "I will write a comprehensive business plan",
    description:
      "Professional business plan including market analysis, financial projections, and marketing strategy.",
    language: "en",
    price: 500,
    deliveryDays: 7,
    revisions: 3,
    categorySlug: "business-management",
    tags: ["business-plan", "strategy"],
    portfolioLinks: [],
  },
  {
    title: "I will photograph your products professionally",
    description:
      "Professional product photography with full editing and white backgrounds ready for e-commerce stores.",
    language: "en",
    price: 600,
    deliveryDays: 5,
    revisions: 2,
    categorySlug: "video-production",
    tags: ["photography", "product"],
    portfolioLinks: [],
  },
  {
    title: "I will produce a professional promo video",
    description:
      "Full promo video production (script, shoot, edit) for your brand or product.",
    language: "en",
    price: 1400,
    deliveryDays: 10,
    revisions: 3,
    categorySlug: "video-production",
    tags: ["video", "editing", "promo"],
    portfolioLinks: [],
  },
  {
    title: "I will teach you conversational English",
    description:
      "Private conversational English lessons with a personalized plan based on your level and goals.",
    language: "en",
    price: 250,
    deliveryDays: 30,
    revisions: 0,
    categorySlug: "languages",
    tags: ["english", "conversation"],
    portfolioLinks: [],
  },
  {
    title: "I will translate between Arabic and English",
    description:
      "Professional, accurate Arabic ↔ English translation. Includes context awareness and technical terminology.",
    language: "en",
    price: 200,
    deliveryDays: 3,
    revisions: 2,
    categorySlug: "languages",
    tags: ["translation", "arabic"],
    portfolioLinks: [],
  },
  {
    title: "I will optimize your website performance",
    description:
      "Comprehensive website performance audit and optimization. Lighthouse score improvements, Core Web Vitals.",
    language: "en",
    price: 750,
    deliveryDays: 5,
    revisions: 2,
    categorySlug: "devops-cloud",
    tags: ["performance", "optimization"],
    portfolioLinks: [],
  },
  {
    title: "I will deploy your app to the cloud (AWS / Vercel)",
    description:
      "Professional cloud infrastructure setup with CI/CD, monitoring, and automated backups.",
    language: "en",
    price: 1100,
    deliveryDays: 7,
    revisions: 2,
    categorySlug: "devops-cloud",
    tags: ["devops", "aws", "cloud"],
    portfolioLinks: [],
  },
  {
    title: "I will review your code and provide expert feedback",
    description:
      "Comprehensive code review with detailed feedback on security, performance, and best practices.",
    language: "en",
    price: 450,
    deliveryDays: 4,
    revisions: 1,
    categorySlug: "web-development",
    tags: ["code-review", "quality"],
    portfolioLinks: [],
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SeededServices {
  all: Service[];
  arabic: Service[];
  english: Service[];
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function seedServices(
  db: PrismaClient,
  users: {
    instructor: User;
    creators: User[];
  },
  categories: Category[]
): Promise<SeededServices> {
  logHeader("💼 Step 6: Services");

  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));
  const allSpecs = [...ARABIC_SERVICES, ...ENGLISH_SERVICES];

  // Cleanup
  logInfo("Cleaning up existing services...");
  await db.service.deleteMany({});

  // Find creators who have certificates (per platform rule)
  const certifiedCreators = await db.user.findMany({
    where: {
      role: "CREATOR",
      certificates: { some: {} },
    },
  });

  // For realistic demo: if fewer than 10 certified creators, use ALL creators
  // (mirrors platform rule but ensures demo-wide service distribution)
  const MIN_CERTIFIED_FOR_POOL = 10;
  const creatorsPool =
    certifiedCreators.length >= MIN_CERTIFIED_FOR_POOL
      ? certifiedCreators
      : [users.instructor, ...users.creators];

  logInfo(
    `Creators pool: ${creatorsPool.length} (certified: ${certifiedCreators.length})`
  );

  const created: Service[] = [];

  for (let i = 0; i < allSpecs.length; i++) {
    const spec = allSpecs[i];
    const creator = creatorsPool[i % creatorsPool.length];
    const category = categoryBySlug.get(spec.categorySlug);
    const slug = `${slugify(spec.title)}-${i + 1}`;

    const service = await db.service.create({
      data: {
        title: spec.title,
        slug,
        description: spec.description,
        thumbnail: PLACEHOLDER_THUMBNAILS[i % PLACEHOLDER_THUMBNAILS.length],
        price: spec.price,
        deliveryDays: spec.deliveryDays,
        revisions: spec.revisions,
        status:
          i % 10 === 9
            ? ServiceStatus.PAUSED
            : ServiceStatus.ACTIVE,
        tags: spec.tags,
        portfolioLinks: spec.portfolioLinks,
        creatorId: creator.id,
        categoryId: category?.id,
        createdAt: daysAgo(randomInt(10, 150)),
      },
    });

    created.push(service);
    logInfo(`  [${i + 1}/${allSpecs.length}] ${spec.title.slice(0, 60)}`);
  }

  const arabic = created.filter((s) => /[\u0600-\u06FF]/.test(s.title));
  const english = created.filter((s) => !/[\u0600-\u06FF]/.test(s.title));

  logSuccess(`${created.length} services created`);
  logInfo(`  🌍 Arabic:  ${arabic.length}`);
  logInfo(`  🌍 English: ${english.length}`);
  logInfo(`  ⏸️  Paused:  ${created.filter((s) => s.status === "PAUSED").length}`);

  return { all: created, arabic, english };
}