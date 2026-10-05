/* eslint-disable @typescript-eslint/no-unused-vars */
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  GraduationCap,
  ChevronRight,
  Star,
  BookOpen,
  Clock,
  Users,
  Globe,
  Award,
  CheckCircle2,
} from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { CourseStatus, EnrollmentStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  CurriculumAccordion,
  type CurriculumSection,
} from "./_components/curriculum-accordion";
import { EnrollButton } from "./_components/enroll-button";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const LEVEL_LABELS = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
} as const;

const LEVEL_STYLES = {
  BEGINNER: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  INTERMEDIATE: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ADVANCED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
} as const;

export default async function CourseDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  // ── Fetch course ──────────────────────────────────────────
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
        select: {
          id: true,
          name: true,
          image: true,
          headline: true,
          bio: true,
        },
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
            select: {
              id: true,
              title: true,
              duration: true,
              isFree: true,
            },
          },
        },
      },
      _count: {
        select: { enrollments: true, reviews: true },
      },
    },
  });

  // Only show PUBLISHED courses publicly
  if (!course || course.status !== CourseStatus.PUBLISHED) notFound();

  // ── Check enrollment ──────────────────────────────────────
  let enrollment: { id: string; progress: number; isPassed: boolean } | null =
    null;
  if (userId) {
    const e = await db.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
      select: { id: true, progress: true, isPassed: true },
    });
    enrollment = e;
  }

  // ── Compute derived data ──────────────────────────────────
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

  // ── Learning outcomes (extracted from tags/description) ──
  const outcomes = [
    `Master ${course.title.toLowerCase()} through hands-on projects`,
    `Build production-ready applications with real-world scenarios`,
    `Learn from ${course.creator.name}, an experienced instructor`,
    `Earn a verified certificate upon successful completion`,
    `Access ${totalLessons} video lessons on any device, anytime`,
    `Join a community of learners and grow your skills`,
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="text-sm font-bold text-white">EduSpark</span>
          </Link>

          <nav className="flex items-center gap-2">
            {session?.user ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-white text-xs font-semibold transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/register"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                >
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ── Breadcrumb ─────────────────────────────────── */}
      <div className="border-b border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-1.5 text-xs text-slate-500">
          <Link href="/courses" className="hover:text-slate-300 transition-colors">
            Courses
          </Link>
          {course.category && (
            <>
              <ChevronRight className="w-3 h-3" />
              <Link
                href={`/courses?category=${course.category.id}`}
                className="hover:text-slate-300 transition-colors"
              >
                {course.category.name}
              </Link>
            </>
          )}
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-400 truncate">{course.title}</span>
        </div>
      </div>

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="relative bg-linear-to-b from-slate-900 to-slate-950 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <div className="grid lg:grid-cols-[1fr_380px] gap-8 lg:gap-12 items-start">
            {/* Left: Content */}
            <div className="space-y-5 min-w-0">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border",
                    LEVEL_STYLES[course.level]
                  )}
                >
                  {LEVEL_LABELS[course.level]}
                </span>
                {course.category && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                    {course.category.name}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight">
                {course.title}
              </h1>

              {/* Description */}
              <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-3xl">
                {course.description}
              </p>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                {course.ratingCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-amber-300 font-bold">
                      {course.totalRating.toFixed(1)}
                    </span>
                    <span>({course.ratingCount} ratings)</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>{course._count.enrollments} students</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{totalLessons} lessons</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  <span>{course.language.toUpperCase()}</span>
                </div>
              </div>

              {/* Instructor row */}
              <div className="flex items-center gap-3 pt-2">
                {course.creator.image ? (
                  <Image
                    src={course.creator.image}
                    alt={course.creator.name}
                    width={36}
                    height={36}
                    className="rounded-full object-cover ring-2 ring-slate-800"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center ring-2 ring-slate-800">
                    {course.creator.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500">Created by</p>
                  <p className="text-sm font-semibold text-slate-200">
                    {course.creator.name}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Enroll card (desktop) */}
            <aside className="hidden lg:block">
              <div className="sticky top-20 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-slate-950">
                  {course.thumbnail ? (
                    <Image
                      src={course.thumbnail}
                      alt={course.title}
                      fill
                      sizes="380px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-indigo-500/10 via-slate-900 to-violet-500/10">
                      <BookOpen className="w-12 h-12 text-slate-700" />
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-5 space-y-4">
                  {/* Price */}
                  <div className="flex items-baseline gap-2">
                    {price === 0 ? (
                      <span className="text-2xl font-black text-emerald-400">
                        Free
                      </span>
                    ) : (
                      <span className="text-3xl font-black text-white tabular-nums">
                        ${price.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* CTA */}
                  <EnrollButton
                    courseId={course.id}
                    price={price}
                    isEnrolled={isEnrolled}
                    isLoggedIn={isLoggedIn}
                    courseSlug={course.slug}
                  />

                  {/* What's included */}
                  <div className="pt-4 border-t border-slate-800 space-y-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      This course includes
                    </p>
                    <ul className="space-y-2">
                      {[
                        `${totalLessons} video lessons`,
                        "Certificate of completion",
                        "Access on mobile and desktop",
                        "Lifetime access",
                      ].map((item) => (
                        <li
                          key={item}
                          className="flex items-center gap-2 text-xs text-slate-400"
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
          {/* Main column */}
          <div className="space-y-8 min-w-0">
            {/* What you'll learn */}
            <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6">
              <h2 className="text-base font-bold text-white mb-4">
                What you&apos;ll learn
              </h2>
              <ul className="grid sm:grid-cols-2 gap-3">
                {outcomes.map((outcome) => (
                  <li
                    key={outcome}
                    className="flex items-start gap-2.5 text-sm text-slate-400 leading-relaxed"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{outcome}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Curriculum */}
            <CurriculumAccordion
              sections={curriculum}
              totalLessons={totalLessons}
              totalDuration={totalDuration}
              isEnrolled={isEnrolled}
            />

            {/* Instructor */}
            <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6">
              <h2 className="text-base font-bold text-white mb-4">
                About the instructor
              </h2>
              <div className="flex items-start gap-4">
                {course.creator.image ? (
                  <Image
                    src={course.creator.image}
                    alt={course.creator.name}
                    width={64}
                    height={64}
                    className="rounded-2xl object-cover ring-2 ring-slate-800 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white text-lg font-bold flex items-center justify-center ring-2 ring-slate-800 shrink-0">
                    {course.creator.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white">
                    {course.creator.name}
                  </h3>
                  {course.creator.headline && (
                    <p className="text-xs text-indigo-400 mt-0.5">
                      {course.creator.headline}
                    </p>
                  )}
                  {course.creator.bio && (
                    <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                      {course.creator.bio}
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Right column (mobile enroll card) */}
          <aside className="lg:hidden">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
              <div className="flex items-baseline gap-2">
                {price === 0 ? (
                  <span className="text-2xl font-black text-emerald-400">
                    Free
                  </span>
                ) : (
                  <span className="text-3xl font-black text-white tabular-nums">
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
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}