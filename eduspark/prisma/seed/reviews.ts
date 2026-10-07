// eduspark/prisma/seed/reviews.ts
import type { Course, PrismaClient, Review, User } from "@prisma/client";
import {
  randomInt,
  randomItem,
  daysAgo,
  logHeader,
  logSuccess,
  logInfo,
} from "./helpers";

// ─── Review Pools ────────────────────────────────────────────────────────────

const ARABIC_REVIEWS = [
  "دورة ممتازة، استفدت منها كثيراً. الشرح واضح ومبسط.",
  "محتوى غني جداً، والمدرب محترف. أنصح بها بشدة.",
  "أفضل دورة عربية في هذا المجال، شكراً للقائمين عليها.",
  "استفدت من الأمثلة العملية بشكل كبير.",
  "دورة شاملة، تغطي كل ما يحتاجه المبتدئ.",
  "الشرح مرتب ومنظم، والأمثلة واقعية.",
  "أسلوب المدرب مميز، جعل التعلم متعة.",
  "الدورة ساعدتني في الحصول على أول وظيفة لي.",
  "محتوى محدث، والتقنيات المستخدمة حديثة.",
  "أنصح كل من يريد دخول المجال بهذه الدورة.",
  "دورة رائعة، لكن أتمنى إضافة المزيد من الأمثلة المتقدمة.",
  "المحتوى جيد، لكن بعض الأجزاء تحتاج توضيح أكثر.",
  "استفدت، لكن تمنيت أن يكون هناك مشاريع أكثر.",
];

const ENGLISH_REVIEWS = [
  "Excellent course! Learned a lot. Highly recommended.",
  "Great content and clear explanations. Worth every penny.",
  "Best course I've taken on this topic.",
  "The hands-on examples really made the difference.",
  "Comprehensive course covering everything a beginner needs.",
  "Well-structured and easy to follow.",
  "The instructor's teaching style is engaging and clear.",
  "This course helped me land my first developer job.",
  "Updated content with modern technologies.",
  "I recommend this to anyone entering the field.",
  "Great course, but I'd love more advanced examples.",
  "Good content, though some sections could be clearer.",
  "Learned a lot, but wished for more projects.",
  "Solid course. The pacing is good for beginners.",
  "Really enjoyed the practical approach.",
];

// ─── Weighted rating (mostly 4-5) ────────────────────────────────────────────

function pickRating(): number {
  const r = Math.random();
  if (r < 0.50) return 5;
  if (r < 0.80) return 4;
  if (r < 0.92) return 3;
  if (r < 0.97) return 2;
  return 1;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SeededReviews {
  all: Review[];
  stats: {
    total: number;
    averageRating: number;
    byRating: Record<number, number>;
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function seedReviews(
  db: PrismaClient,
  users: { students: User[]; student: User; client: User },
  courses: { all: Course[] }
): Promise<SeededReviews> {
  logHeader("⭐ Step 8: Reviews");

  await db.review.deleteMany({});

  const REVIEW_TARGET = 200;
  const reviewers = [users.student, users.client, ...users.students];

  const usedPairs = new Set<string>();
  const createdReviews: Review[] = [];
  const byRating: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  let attempts = 0;
  while (createdReviews.length < REVIEW_TARGET && attempts < REVIEW_TARGET * 10) {
    attempts++;
    const course = courses.all[randomInt(0, courses.all.length - 1)];
    const reviewer = reviewers[randomInt(0, reviewers.length - 1)];
    const pairKey = `${course.id}:${reviewer.id}`;

    if (usedPairs.has(pairKey)) continue;
    if (course.creatorId === reviewer.id) continue;
    usedPairs.add(pairKey);

    const isArabicCourse = course.language === "ar";
    const rating = pickRating();
    const comment = isArabicCourse
      ? randomItem(ARABIC_REVIEWS)
      : randomItem(ENGLISH_REVIEWS);

    const review = await db.review.create({
      data: {
        userId: reviewer.id,
        courseId: course.id,
        rating,
        comment,
        createdAt: daysAgo(randomInt(1, 180)),
      },
    });

    createdReviews.push(review);
    byRating[rating] = (byRating[rating] || 0) + 1;
  }

  // Update each course's totalRating + ratingCount
  logInfo("Updating course rating aggregates...");
  const coursesToUpdate = await db.course.findMany({
    include: { reviews: true },
  });

  for (const course of coursesToUpdate) {
    if (course.reviews.length === 0) continue;
    const sum = course.reviews.reduce((s, r) => s + r.rating, 0);
    const avg = sum / course.reviews.length;

    await db.course.update({
      where: { id: course.id },
      data: {
        totalRating: Number(avg.toFixed(2)),
        ratingCount: course.reviews.length,
      },
    });
  }

  const averageRating =
    createdReviews.reduce((s, r) => s + r.rating, 0) / createdReviews.length;

  logSuccess(`${createdReviews.length} reviews created`);
  logInfo(`  Average rating: ${averageRating.toFixed(2)}`);
  logInfo("  Distribution:");
  for (let i = 5; i >= 1; i--) {
    logInfo(`    ${i}★ → ${byRating[i]}`);
  }

  return {
    all: createdReviews,
    stats: {
      total: createdReviews.length,
      averageRating: Number(averageRating.toFixed(2)),
      byRating,
    },
  };
}