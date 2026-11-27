/* eslint-disable @typescript-eslint/no-unused-vars */
import { COURSE_REVIEW_MIN_PROGRESS } from "@/lib/lms/review-policy";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  ChevronRight,
  Star,
  BookOpen,
  Users,
  Globe,
  CheckCircle2,
} from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { CourseStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  CurriculumAccordion,
  type CurriculumSection,
} from "./_components/curriculum-accordion";
import { EnrollButton } from "./_components/enroll-button";
import { CourseReviews } from "@/components/reviews/course-reviews";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

const LEVEL_STYLES = {
  BEGINNER: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  INTERMEDIATE: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  ADVANCED: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
} as const;

export async function generateMetadata({ params }: PageProps) {
  const { slug, locale } = await params;
  const course = await db.course.findUnique({
    where: { slug },
    select: { title: true, description: true },
  });
  if (!course) return { title: "Course not found — EduSpark" };
  return {
    title: `${course.title} — EduSpark`,
    description: course.description,
  };
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const t = await getTranslations();
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const userRole = session?.user?.role;

  const course = await db.course.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      thumbnail: true,
      price: true,
      level: true,
      language: true,
      status: true,
      tags: true,
      totalRating: true,
      ratingCount: true,
      createdAt: true,
      creator: {
        select: { id: true, name: true, headline: true, bio: true },
      },
      category: { select: { id: true, name: true, slug: true } },
      sections: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          order: true,
          lessons: {
            orderBy: { order: "asc" },
            select: { id: true, title: true, duration: true, isFree: true },
          },
        },
      },
      _count: { select: { enrollments: true, reviews: true } },
    },
  });

  if (!course || course.status !== CourseStatus.PUBLISHED) notFound();

  let enrollment: { id: string; progress: number; isPassed: boolean } | null =
    null;
  if (userId) {
    const e = await db.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
      select: { id: true, progress: true, isPassed: true },
    });
    enrollment = e;
  }

  const [reviewsData, userReview] = await Promise.all([
    db.review.findMany({
      where: { courseId: course.id },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        user: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    userId
      ? db.review.findFirst({
          where: { userId, courseId: course.id },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  const totalLessons = course.sections.reduce(
    (sum, s) => sum + s.lessons.length,
    0
  );
  const totalDuration = course.sections.reduce(
    (sum, s) =>
      sum + s.lessons.reduce((ls, l) => ls + (l.duration ?? 0), 0),
    0
  );

  const curriculum: CurriculumSection[] = course.sections.map((s) => ({
    id: s.id,
    title: s.title,
    order: s.order,
    lessons: s.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      duration: l.duration,
      isFree: l.isFree,
    })),
  }));

  const price = Number(course.price);
  const isEnrolled = !!enrollment;
  const isLoggedIn = !!userId;

  const creatorInitials = course.creator.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const creatorHue =
    course.creator.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) %
    360;

  const levelKey = course.level.toLowerCase() as
    | "beginner"
    | "intermediate"
    | "advanced";
  const levelLabel = t(`courses.filters.levels.${levelKey}`);

  const outcomes = [
    t("courses.detail.outcomes.master", { title: course.title.toLowerCase() }),
    t("courses.detail.outcomes.build"),
    t("courses.detail.outcomes.learnFrom", { creator: course.creator.name }),
    t("courses.detail.outcomes.certificate"),
    t("courses.detail.outcomes.accessLessons", { count: totalLessons }),
    t("courses.detail.outcomes.community"),
  ];

  const includesItems = [
    t("courses.detail.includesLessons", { count: totalLessons }),
    t("courses.detail.includesCertificate"),
    t("courses.detail.includesAccess"),
    t("courses.detail.includesLifetime"),
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Breadcrumb ─────────────────────────────────── */}
      <div className="border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link
            href="/courses"
            className="hover:text-foreground transition-colors"
          >
            {t("courses.detail.breadcrumb")}
          </Link>
          {course.category && (
            <>
              <ChevronRight className="w-3 h-3" />
              <Link
                href={`/courses?category=${course.category.id}`}
                className="hover:text-foreground transition-colors"
              >
                {course.category.name}
              </Link>
            </>
          )}
          <ChevronRight className="w-3 h-3" />
          <span className="text-muted-foreground truncate">{course.title}</span>
        </div>
      </div>

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="relative bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <div className="grid lg:grid-cols-[1fr_380px] gap-8 lg:gap-12 items-start">
            <div className="space-y-5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border",
                    LEVEL_STYLES[course.level]
                  )}
                >
                  {levelLabel}
                </span>
                {course.category && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                    {course.category.name}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground leading-tight">
                {course.title}
              </h1>

              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-3xl">
                {course.description}
              </p>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                {course.ratingCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                      {course.totalRating.toFixed(1)}
                    </span>
                    <span>
                      {t("courses.detail.ratingCount", {
                        count: course.ratingCount,
                      })}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>
                    {t("courses.detail.studentsCount", {
                      count: course._count.enrollments,
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>
                    {t("courses.detail.lessonsCount", { count: totalLessons })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  <span>{course.language.toUpperCase()}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-border shrink-0"
                  style={{ background: `hsl(${creatorHue}, 50%, 38%)` }}
                >
                  {creatorInitials}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("courses.detail.createdBy")}
                  </p>
                  <Link
                    href={`/profile/${course.creator.id}`}
                    className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    {course.creator.name}
                  </Link>
                </div>
              </div>
            </div>

            {/* Desktop enroll card */}
            <aside className="hidden lg:block">
              <div className="sticky top-20 rounded-2xl bg-card border border-border overflow-hidden">
                <div className="relative aspect-video bg-background">
                  {course.thumbnail ? (
                    <Image
                      src={course.thumbnail}
                      alt={course.title}
                      fill
                      sizes="380px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-emerald-500/10 via-muted to-emerald-500/10">
                      <BookOpen className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex items-baseline gap-2">
                    {price === 0 ? (
                      <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        {t("courses.detail.free")}
                      </span>
                    ) : (
                      <span className="text-3xl font-black text-foreground tabular-nums">
                        ${price.toFixed(2)}
                      </span>
                    )}
                  </div>

                  <EnrollButton
                    courseId={course.id}
                    price={price}
                    isEnrolled={isEnrolled}
                    isLoggedIn={isLoggedIn}
                    courseSlug={course.slug}
                    userRole={userRole}
                  />

                  <div className="pt-4 border-t border-border space-y-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {t("courses.detail.includesTitle")}
                    </p>
                    <ul className="space-y-2">
                      {includesItems.map((item) => (
                        <li
                          key={item}
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ── Main content ───────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid lg:grid-cols-[1fr_380px] gap-8 lg:gap-12">
          <div className="space-y-8 min-w-0">
            <section className="rounded-2xl bg-card border border-border p-5 sm:p-6">
              <h2 className="text-base font-bold text-foreground mb-4">
                {t("courses.detail.learningTitle")}
              </h2>
              <ul className="grid sm:grid-cols-2 gap-3">
                {outcomes.map((outcome) => (
                  <li
                    key={outcome}
                    className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{outcome}</span>
                  </li>
                ))}
              </ul>
            </section>

            <CurriculumAccordion
              sections={curriculum}
              totalLessons={totalLessons}
              totalDuration={totalDuration}
              isEnrolled={isEnrolled}
            />

            <CourseReviews
              courseId={course.id}
              reviews={reviewsData.map((r) => ({
                ...r,
                createdAt: r.createdAt.toISOString(),
              }))}
              averageRating={course.totalRating}
              ratingCount={course.ratingCount}
              canReview={
                isEnrolled &&
                (enrollment?.progress ?? 0) >= COURSE_REVIEW_MIN_PROGRESS
              }
              needsProgress={
                isEnrolled &&
                (enrollment?.progress ?? 0) < COURSE_REVIEW_MIN_PROGRESS
              }
              alreadyReviewed={userReview !== null}
            />

            <section className="rounded-2xl bg-card border border-border p-5 sm:p-6">
              <h2 className="text-base font-bold text-foreground mb-4">
                {t("courses.detail.instructorTitle")}
              </h2>
              <div className="flex items-start gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-lg font-bold ring-2 ring-border shrink-0"
                  style={{ background: `hsl(${creatorHue}, 50%, 38%)` }}
                >
                  {creatorInitials}
                </div>
                <div className="min-w-0">
                  <Link
                    href={`/profile/${course.creator.id}`}
                    className="text-sm font-bold text-foreground hover:text-primary transition-colors"
                  >
                    {course.creator.name}
                  </Link>
                  {course.creator.headline && (
                    <p className="text-xs text-primary mt-0.5">
                      {course.creator.headline}
                    </p>
                  )}
                  {course.creator.bio && (
                    <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                      {course.creator.bio}
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Mobile enroll card */}
          <aside className="lg:hidden">
            <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
              <div className="flex items-baseline gap-2">
                {price === 0 ? (
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {t("courses.detail.free")}
                  </span>
                ) : (
                  <span className="text-3xl font-black text-foreground tabular-nums">
                    ${price.toFixed(2)}
                  </span>
                )}
              </div>
              <EnrollButton
                courseId={course.id}
                price={price}
                isEnrolled={isEnrolled}
                isLoggedIn={isLoggedIn}
                courseSlug={course.slug}
                userRole={userRole}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}