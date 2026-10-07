import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

// ============================================================================
// Build user context for AI responses
// ============================================================================

export interface UserContext {
  userId: string;
  name: string;
  role: Role;
  // Learning
  enrollmentsCount: number;
  completedCoursesCount: number;
  certificatesCount: number;
  enrolledCourseTitles: string[];
  certifiedCourseTitles: string[];
  categoriesOfInterest: string[];
  // Creator
  servicesCount: number;
  activeServicesCount: number;
  // Orders
  ordersAsBuyer: number;
  ordersAsCreator: number;
  // Recommendations
  recommendedCourses: Array<{
    id: string;
    title: string;
    slug: string;
    level: string;
    price: number;
    categoryName: string | null;
  }>;
}

export async function buildUserContext(
  userId: string
): Promise<UserContext | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      role: true,
      enrollments: {
        select: {
          course: {
            select: {
              id: true,
              title: true,
              categoryId: true,
            },
          },
          isPassed: true,
        },
      },
      certificates: {
        select: {
          course: {
            select: {
              title: true,
              categoryId: true,
            },
          },
        },
      },
      services: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!user) return null;

  // Enrolled & certified
  const enrolledCourseTitles = user.enrollments.map((e) => e.course.title);
  const certifiedCourseTitles = user.certificates.map(
    (c) => c.course.title
  );
  const completedCoursesCount = user.enrollments.filter(
    (e) => e.isPassed
  ).length;

  // Categories of interest (from enrollments + certificates)
  const categoryIdSet = new Set<string>();
  user.enrollments.forEach((e) => {
    if (e.course.categoryId) categoryIdSet.add(e.course.categoryId);
  });
  user.certificates.forEach((c) => {
    if (c.course.categoryId) categoryIdSet.add(c.course.categoryId);
  });
  const categoryIds = Array.from(categoryIdSet);

  // Get category names
  const categories =
    categoryIds.length > 0
      ? await db.category.findMany({
          where: { id: { in: categoryIds } },
          select: { name: true },
        })
      : [];
  const categoriesOfInterest = categories.map((c) => c.name);

  // Orders
  const [ordersAsBuyer, ordersAsCreator] = await Promise.all([
    db.project.count({ where: { clientId: userId } }),
    db.project.count({ where: { creatorId: userId } }),
  ]);

  // Recommended courses
  const enrolledCourseIds = user.enrollments.map((e) => e.course.id);

  const recommendedCourses = await db.course.findMany({
    where: {
      status: "PUBLISHED",
      id: { notIn: enrolledCourseIds },
      ...(categoryIds.length > 0 && {
        categoryId: { in: categoryIds },
      }),
    },
    take: 3,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      level: true,
      price: true,
      category: { select: { name: true } },
    },
  });

  // If no recommendations based on category, get any popular ones
  let finalRecommendations = recommendedCourses;
  if (finalRecommendations.length === 0) {
    finalRecommendations = await db.course.findMany({
      where: {
        status: "PUBLISHED",
        id: { notIn: enrolledCourseIds },
      },
      take: 3,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        level: true,
        price: true,
        category: { select: { name: true } },
      },
    });
  }

  return {
    userId: user.id,
    name: user.name,
    role: user.role,
    enrollmentsCount: user.enrollments.length,
    completedCoursesCount,
    certificatesCount: user.certificates.length,
    enrolledCourseTitles,
    certifiedCourseTitles,
    categoriesOfInterest,
    servicesCount: user.services.length,
    activeServicesCount: user.services.filter((s) => s.status === "ACTIVE")
      .length,
    ordersAsBuyer,
    ordersAsCreator,
    recommendedCourses: finalRecommendations.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      level: c.level,
      price: Number(c.price),
      categoryName: c.category?.name ?? null,
    })),
  };
}