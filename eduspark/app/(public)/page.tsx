import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { QUIZ_PASSING_SCORE } from "@/lib/lms/quiz-policy";
import {
  Sparkles,
  GraduationCap,
  Store,
  Target,
  Trophy,
  BookOpen,
  Award,
  Users,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Brain,
  MessageSquare,
  Star,
  Zap,
  Rocket,
} from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { CourseStatus, ServiceStatus } from "@prisma/client";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const isLoggedIn = !!session?.user;

  // â”€â”€ Live platform stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [coursesCount, usersCount, certificatesCount, servicesCount] =
    await Promise.all([
      db.course.count({ where: { status: CourseStatus.PUBLISHED } }),
      db.user.count({ where: { isActive: true } }),
      db.certificate.count(),
      db.service.count({ where: { status: ServiceStatus.ACTIVE } }),
    ]);

  // â”€â”€ Top 3 featured courses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const featuredCourses = await db.course.findMany({
    where: { status: CourseStatus.PUBLISHED },
    orderBy: [{ totalRating: "desc" }, { ratingCount: "desc" }],
    take: 3,
    select: {
      id: true,
      title: true,
      slug: true,
      thumbnail: true,
      price: true,
      level: true,
      language: true,
      totalRating: true,
      ratingCount: true,
      category: { select: { name: true } },
    },
  });

  const primaryCta = isLoggedIn
    ? { label: "Go to Dashboard", href: "/dashboard" }
    : { label: "Get Started Free", href: "/auth/register" };

  return (
    <div className="overflow-hidden">
      {/* â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
          HERO
      â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ */}
      <section className="relative">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-linear-to-b from-emerald-100/60 via-background to-background dark:from-emerald-950/40 dark:via-zinc-950 dark:to-zinc-950" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-200 h-100 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 lg:pt-28 lg:pb-32">
          <div className="text-center max-w-3xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Powered by AI آ· Certified Marketplace</span>
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-black text-white tracking-tight leading-[1.05] mb-6">
              Learn .. Certify
              <br />
              <span className="bg-linear-to-r from-emerald-400 via-emerald-400 to-fuchsia-400 bg-clip-text text-transparent">
                Build your career
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
              EduSpark combines expert-led courses, verified certificates, and a
              certified marketplace  where proven learners become trusted
              creators.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={primaryCta.href}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-primary hover:bg-primary text-primary-foreground text-sm font-bold transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/30"
              >
                {primaryCta.label}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/courses"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-card hover:bg-accent text-foreground text-sm font-bold border border-border transition-all active:scale-[0.98]"
              >
                <GraduationCap className="w-4 h-4" />
                Browse Courses
              </Link>
            </div>

            {/* Mini trust indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Free to start</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>No credit card needed</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Lifetime access</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
          STATS
      â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ */}
      <section className="relative border-y border-border/60 bg-background/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            <StatCard
              icon={BookOpen}
              value={coursesCount}
              label="Published Courses"
              color="text-primary"
            />
            <StatCard
              icon={Users}
              value={usersCount}
              label="Active Learners"
              color="text-emerald-400"
            />
            <StatCard
              icon={Award}
              value={certificatesCount}
              label="Certificates Issued"
              color="text-amber-400"
            />
            <StatCard
              icon={Store}
              value={servicesCount}
              label="Active Services"
              color="text-info"
            />
          </div>
        </div>
      </section>

      {/* â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
          FEATURES
      â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
            What makes us different
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Everything you need to grow
          </h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            Four pillars working together to turn learners into certified
            professionals.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FeatureCard
            icon={GraduationCap}
            title="Learn from the best"
            description="A curated catalog of expert-led courses across web development, data science, design, and more. Complete courses and earn verifiable certificates."
            gradient="from-emerald-500 to-blue-600"
            href="/courses"
            ctaLabel="Browse Courses"
          />
          <FeatureCard
            icon={Award}
            title="Get certified"
            description={`Pass an ${QUIZ_PASSING_SCORE}%+ certification quiz to unlock a unique credential ID. Your certificate upgrades you to a certified creator on the platform.`}
            gradient="from-amber-500 to-orange-600"
            ctaLabel="How it works"
            href="/courses"
          />
          <FeatureCard
            icon={Store}
            title="Sell your expertise"
            description="Only certified creators can publish services. Offer your skills to clients through a marketplace built on proven credentials."
            gradient="from-emerald-500 to-teal-600"
            href="/marketplace"
            ctaLabel="Explore Marketplace"
          />
          <FeatureCard
            icon={Brain}
            title="AI-powered guidance"
            description="Our AI assistant answers questions, recommends courses, and builds personalized career paths tailored to your goals."
            gradient="from-emerald-500 to-fuchsia-600"
            ctaLabel="Try AI Assistant"
            href={isLoggedIn ? "/dashboard" : "/auth/register"}
          />
        </div>
      </section>

      {/* â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
          FEATURED COURSES
      â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ */}
      {featuredCourses.length > 0 && (
        <section className="bg-card/30 border-y border-border/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
                  Top rated
                </p>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  Featured courses
                </h2>
              </div>
              <Link
                href="/courses"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary font-semibold transition-colors"
              >
                View all courses
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {featuredCourses.map((course) => (
                <Link
                  key={course.id}
                  href={`/courses/${course.slug}`}
                  className="group rounded-2xl bg-card border border-border overflow-hidden hover:border-primary/40 transition-all hover:-translate-y-1"
                >
                  <div className="relative aspect-video bg-accent">
                    {course.thumbnail ? (
                      <Image
                        src={course.thumbnail}
                        alt={course.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-emerald-600/30 to-emerald-600/30">
                        <GraduationCap className="w-12 h-12 text-white/30" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/30">
                      {course.level.toLowerCase()}
                    </div>
                  </div>

                  <div className="p-5">
                    {course.category && (
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">
                        {course.category.name}
                      </p>
                    )}
                    <h3 className="text-sm font-bold text-white line-clamp-2 leading-snug mb-3 group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>

                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div className="flex items-center gap-1 text-xs">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span className="font-bold text-foreground">
                          {course.totalRating.toFixed(1)}
                        </span>
                        <span className="text-muted-foreground/70">
                          ({course.ratingCount})
                        </span>
                      </div>
                      <span className="text-sm font-black text-white tabular-nums">
                        ${Number(course.price).toFixed(0)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
          HOW IT WORKS
      â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
            Your journey
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            From learner to creator
          </h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            Three steps from curiosity to a thriving creator business.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          <Step
            number={1}
            icon={BookOpen}
            title="Enroll & learn"
            description="Pick a course from our curated catalog. Watch lessons at your own pace, on any device."
            color="text-primary"
            bg="bg-primary/10"
            border="border-primary/20"
          />
          <Step
            number={2}
            icon={Award}
            title="Pass & get certified"
            description={`Complete all lessons, pass the ${QUIZ_PASSING_SCORE}% quiz, and receive a verifiable certificate with a unique credential ID.`}
            color="text-amber-400"
            bg="bg-amber-500/10"
            border="border-amber-500/20"
          />
          <Step
            number={3}
            icon={Store}
            title="Offer your services"
            description="Your certification unlocks creator mode. Publish services, receive orders, and grow your reputation."
            color="text-emerald-400"
            bg="bg-emerald-500/10"
            border="border-emerald-500/20"
          />
        </div>
      </section>

      {/* â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
          EXTRA FEATURES GRID
      â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ */}
      <section className="relative border-y border-border/60 bg-background/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-10 lg:gap-8">
            <SmallFeature
              icon={Target}
              title="AI Career Paths"
              description="Personalized learning plans built by AI based on your goals."
            />
            <SmallFeature
              icon={Trophy}
              title="Gamification"
              description="Earn XP, unlock badges, and climb the leaderboard."
            />
            <SmallFeature
              icon={MessageSquare}
              title="Real-time Chat"
              description="Direct messaging between clients and creators."
            />
            <SmallFeature
              icon={ShieldCheck}
              title="Verified Creators"
              description="Every seller holds a verified certificate."
            />
            <SmallFeature
              icon={Zap}
              title="Fast & Modern"
              description="Built with Next.js 16, Redis cache, and Prisma 7."
            />
            <SmallFeature
              icon={Rocket}
              title="Milestone Tracking"
              description="Track progress on every project, step by step."
            />
          </div>
        </div>
      </section>

      {/* â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
          FINAL CTA
      â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ */}
      <section className="relative">
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-emerald-100/30 to-background dark:via-emerald-950/20 dark:to-zinc-950" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="rounded-3xl bg-linear-to-br from-emerald-600/20 via-emerald-600/10 to-fuchsia-600/20 border border-primary/20 p-10 sm:p-14 text-center">
            <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/30">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
              Ready to start?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
              Join {usersCount.toLocaleString("en-US")}+ learners who are
              building their careers on EduSpark.
            </p>
            <Link
              href={primaryCta.href}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary hover:bg-primary text-primary-foreground text-base font-bold transition-all active:scale-[0.98] shadow-2xl shadow-emerald-500/30"
            >
              {primaryCta.label}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StatCard({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="text-center px-2">
      <Icon className={`w-5 h-5 mx-auto mb-3 ${color}`} />
      <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">
        {value.toLocaleString("en-US")}
      </p>
      <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-3 leading-tight">
        {label}
      </p>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  gradient,
  href,
  ctaLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  gradient: string;
  href?: string;
  ctaLabel?: string;
}) {
  const content = (
    <div className="group rounded-3xl bg-card border border-border p-7 sm:p-8 h-full transition-all hover:border-border hover:-translate-y-0.5">
      <div
        className={`w-12 h-12 rounded-2xl bg-linear-to-br ${gradient} flex items-center justify-center mb-5 shadow-lg`}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">
        {description}
      </p>
      {ctaLabel && (
        <div className="flex items-center gap-1.5 text-xs font-bold text-primary group-hover:text-primary transition-colors">
          <span>{ctaLabel}</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function Step({
  number,
  icon: Icon,
  title,
  description,
  color,
  bg,
  border,
}: {
  number: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <div className="relative">
      {/* Connecting line */}
      <div className="hidden md:block absolute top-8 left-[calc(50%+60px)] right-[calc(-50%+60px)] h-px bg-linear-to-r from-border to-transparent dark:from-zinc-800" />

      <div className={`relative rounded-3xl ${bg} ${border} border p-7`}>
        <div className="flex items-center gap-4 mb-5">
          <div
            className={`w-12 h-12 rounded-2xl ${bg} ${border} border flex items-center justify-center shrink-0`}
          >
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <span
            className={`text-5xl font-black ${color} opacity-30 leading-none`}
          >
            {number.toString().padStart(2, "0")}
          </span>
        </div>
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function SmallFeature({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl bg-card border border-border p-5 hover:border-border transition-colors">
      <div className="w-10 h-10 rounded-xl bg-accent border border-border flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0">
        <h4 className="text-sm font-bold text-white mb-1">{title}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}