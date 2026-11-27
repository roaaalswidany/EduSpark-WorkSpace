import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BookOpen, Search } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { CourseCard, type CourseCardData } from "@/components/lms/course-card";
import {
  CoursesFilterBar,
  type CategoryOption,
} from "./_components/courses-filter-bar";
import { Prisma, CourseStatus, CourseLevel } from "@prisma/client";
import { cached } from "@/lib/cache";
import { CacheKeys, CacheTTL } from "@/lib/cache-keys";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    category?: string;
    level?: string;
    sort?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 12;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "courses" });
  return {
    title: `${t("hero.title")} ${t("hero.titleHighlight")} — EduSpark`,
    description: t("hero.description"),
  };
}

export default async function CoursesPage({ searchParams }: PageProps) {
  const t = await getTranslations("courses");
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  // ── Build where clause ──────────────────────────────────────────
  const where: Prisma.CourseWhereInput = {
    status: CourseStatus.PUBLISHED,
  };

  if (sp.q?.trim()) {
    const q = sp.q.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { tags: { hasSome: [q] } },
    ];
  }

  if (sp.category) where.categoryId = sp.category;

  if (
    sp.level &&
    Object.values(CourseLevel).includes(sp.level as CourseLevel)
  ) {
    where.level = sp.level as CourseLevel;
  }

  // ── Sort mapping ────────────────────────────────────────────────
  let orderBy: Prisma.CourseOrderByWithRelationInput = { createdAt: "desc" };
  switch (sp.sort) {
    case "popular":
      orderBy = { ratingCount: "desc" };
      break;
    case "rating":
      orderBy = { totalRating: "desc" };
      break;
    case "price-low":
      orderBy = { price: "asc" };
      break;
    case "price-high":
      orderBy = { price: "desc" };
      break;
  }

  // ── Cache key ───────────────────────────────────────────────────
  const listCacheKey = CacheKeys.coursesList({
    q: sp.q,
    category: sp.category,
    level: sp.level,
    sort: sp.sort,
    page,
  });

  // ── Fetch data in parallel ──────────────────────────────────────
  const [{ coursesRaw, total }, categoriesRaw] = await Promise.all([
    cached(listCacheKey, CacheTTL.medium, async () => {
      const [courses, count] = await Promise.all([
        db.course.findMany({
          where,
          orderBy,
          skip,
          take: PAGE_SIZE,
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            thumbnail: true,
            price: true,
            level: true,
            language: true,
            tags: true,
            totalRating: true,
            ratingCount: true,
            creator: {
              select: { id: true, name: true, headline: true },
            },
            category: { select: { id: true, name: true, slug: true } },
            sections: {
              select: {
                lessons: { select: { id: true, duration: true } },
              },
            },
          },
        }),
        db.course.count({ where }),
      ]);
      return { coursesRaw: courses, total: count };
    }),

    cached(CacheKeys.coursesCategories(), CacheTTL.long, () =>
      db.category.findMany({
        where: {
          courses: { some: { status: CourseStatus.PUBLISHED } },
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          _count: {
            select: {
              courses: { where: { status: CourseStatus.PUBLISHED } },
            },
          },
        },
      })
    ),
  ]);

  // ── Enrollments ─────────────────────────────────────────────────
  let enrollmentMap = new Map<
    string,
    { progress: number; isPassed: boolean }
  >();

  if (userId && coursesRaw.length > 0) {
    const enrollments = await db.enrollment.findMany({
      where: {
        userId,
        courseId: { in: coursesRaw.map((c) => c.id) },
      },
      select: { courseId: true, progress: true, isPassed: true },
    });
    enrollmentMap = new Map(
      enrollments.map((e) => [
        e.courseId,
        { progress: e.progress, isPassed: e.isPassed },
      ])
    );
  }

  // ── Shape courses ───────────────────────────────────────────────
  const courses: CourseCardData[] = coursesRaw.map((c) => {
    const totalLessons = c.sections.reduce(
      (sum, s) => sum + s.lessons.length,
      0
    );
    const totalDuration = c.sections.reduce(
      (sum, s) =>
        sum + s.lessons.reduce((lsum, l) => lsum + (l.duration ?? 0), 0),
      0
    );
    const enrollment = enrollmentMap.get(c.id);

    return {
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      thumbnail: c.thumbnail,
      price: Number(c.price),
      level: c.level as CourseLevel,
      language: c.language,
      tags: c.tags,
      totalRating: c.totalRating,
      ratingCount: c.ratingCount,
      creator: c.creator,
      category: c.category,
      totalLessons,
      totalDuration,
      isEnrolled: !!enrollment,
      enrollmentProgress: enrollment?.progress ?? null,
      isPassed: enrollment?.isPassed ?? false,
    };
  });

  const categories: CategoryOption[] = categoriesRaw.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    count: cat._count.courses,
  }));

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters =
    !!sp.q ||
    !!sp.category ||
    !!sp.level ||
    (sp.sort && sp.sort !== "newest");

  // ── Build pagination URL ────────────────────────────────────────
  function buildPageUrl(targetPage: number): string {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.category) params.set("category", sp.category);
    if (sp.level) params.set("level", sp.level);
    if (sp.sort) params.set("sort", sp.sort);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/courses${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-6">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-4">
            <BookOpen className="w-3 h-3" />
            {t("hero.availableBadge", { count: total })}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight leading-tight">
            {t("hero.title")}{" "}
            <span className="bg-linear-to-r from-emerald-400 to-emerald-400 bg-clip-text text-transparent">
              {t("hero.titleHighlight")}
            </span>
          </h1>
          <p className="mt-3 text-muted-foreground text-sm sm:text-base leading-relaxed">
            {t("hero.description")}
          </p>
        </div>
      </section>

      {/* ── Filters ───────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <CoursesFilterBar categories={categories} totalCourses={total} />
      </section>

      {/* ── Results ───────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-muted-foreground">
            {total === 0
              ? t("results.noCourses")
              : t("results.showingRange", {
                  start: skip + 1,
                  end: Math.min(skip + PAGE_SIZE, total),
                  total,
                })}
          </p>
          {totalPages > 1 && (
            <p className="text-xs text-muted-foreground/70">
              {t("results.pageOf", { page, total: totalPages })}
            </p>
          )}
        </div>

        {courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-4">
              <Search className="w-7 h-7 text-muted-foreground/70" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">
              {t("results.noCourses")}
            </h3>
            <p className="text-sm text-muted-foreground/70 max-w-sm mb-5">
              {hasFilters ? t("results.tryAdjusting") : t("results.noPublished")}
            </p>
            {hasFilters && (
              <Link
                href="/courses"
                className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/80 text-foreground text-xs font-semibold transition-colors"
              >
                {t("results.clearFilters")}
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            {page > 1 && (
              <Link
                href={buildPageUrl(page - 1)}
                className="px-4 py-2 rounded-lg bg-card border border-border hover:border-primary/40 text-foreground text-xs font-semibold transition-colors"
              >
                ← {t("results.previous")}
              </Link>
            )}

            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;
              if (
                p === 1 ||
                p === totalPages ||
                (p >= page - 1 && p <= page + 1)
              ) {
                return (
                  <Link
                    key={p}
                    href={buildPageUrl(p)}
                    className={
                      p === page
                        ? "w-9 h-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold"
                        : "w-9 h-9 flex items-center justify-center rounded-lg bg-card border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors"
                    }
                  >
                    {p}
                  </Link>
                );
              }
              if (p === page - 2 || p === page + 2) {
                return (
                  <span key={p} className="text-muted-foreground/70 text-xs">
                    ...
                  </span>
                );
              }
              return null;
            })}

            {page < totalPages && (
              <Link
                href={buildPageUrl(page + 1)}
                className="px-4 py-2 rounded-lg bg-card border border-border hover:border-primary/40 text-foreground text-xs font-semibold transition-colors"
              >
                {t("results.next")} →
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}