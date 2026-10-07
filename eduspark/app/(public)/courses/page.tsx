import { getServerSession } from "next-auth";
import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { CourseCard, type CourseCardData } from "@/components/lms/course-card";
import {
  CoursesFilterBar,
  type CategoryOption,
} from "./_components/courses-filter-bar";
import { Prisma, CourseStatus, CourseLevel } from "@prisma/client";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    level?: string;
    sort?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 12;

export default async function CoursesPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  // ── Build where clause ─────────────────────────────────
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

  // ── Sort mapping ───────────────────────────────────────
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

  // ── Fetch data in parallel ─────────────────────────────
  const [coursesRaw, total, categoriesRaw] = await Promise.all([
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
          select: { id: true, name: true, image: true, headline: true },
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
    }),
  ]);

  // ── Enrollments for current user ───────────────────────
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

  // ── Shape courses ──────────────────────────────────────
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
      level: c.level,
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

  // ── Build pagination URL helper ────────────────────────
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ── Hero ───────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-6">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-4">
            <BookOpen className="w-3 h-3" />
            {total} {total === 1 ? "course" : "courses"} available
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
            Learn from the best,{" "}
            <span className="bg-linear-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              at your own pace.
            </span>
          </h1>
          <p className="mt-3 text-slate-500 text-sm sm:text-base leading-relaxed">
            Discover expert-led courses, earn certificates, and unlock your
            potential with EduSpark.
          </p>
        </div>
      </section>

      {/* ── Filters ────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <CoursesFilterBar categories={categories} totalCourses={total} />
      </section>

      {/* ── Results ────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Results count */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-slate-500">
            {total === 0
              ? "No courses found"
              : `Showing ${skip + 1}–${Math.min(skip + PAGE_SIZE, total)} of ${total}`}
          </p>
          {totalPages > 1 && (
            <p className="text-xs text-slate-600">
              Page {page} of {totalPages}
            </p>
          )}
        </div>

        {/* Grid or Empty */}
        {courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
              <Search className="w-7 h-7 text-slate-700" />
            </div>
            <h3 className="text-base font-bold text-slate-300 mb-1">
              No courses found
            </h3>
            <p className="text-sm text-slate-600 max-w-sm mb-5">
              {hasFilters
                ? "Try adjusting your filters or search query."
                : "No published courses yet. Check back soon!"}
            </p>
            {hasFilters && (
              <Link
                href="/courses"
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Clear filters
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            {page > 1 && (
              <Link
                href={buildPageUrl(page - 1)}
                className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                ← Previous
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
                        ? "w-9 h-9 flex items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-bold"
                        : "w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-xs font-semibold transition-colors"
                    }
                  >
                    {p}
                  </Link>
                );
              }
              if (p === page - 2 || p === page + 2) {
                return (
                  <span key={p} className="text-slate-700 text-xs">
                    …
                  </span>
                );
              }
              return null;
            })}

            {page < totalPages && (
              <Link
                href={buildPageUrl(page + 1)}
                className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Next →
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}