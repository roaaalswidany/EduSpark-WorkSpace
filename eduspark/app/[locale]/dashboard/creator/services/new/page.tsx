/* eslint-disable @typescript-eslint/no-unused-vars */
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslations, getLocale } from "next-intl/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { ServiceCreationForm } from "./_components/service-creation-form";
import { GraduationCap, Award, AlertCircle } from "lucide-react";
import { QUIZ_PASSING_SCORE } from "@/lib/lms/quiz-policy";
import { Link } from "@/i18n/navigation";

export interface CertifiedCourseOption {
  courseId: string;
  courseTitle: string;
  courseLevel: string;
  score: number;
  credentialId: string;
}

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "serviceForm.newPage",
  });
  return { title: `${t("metadataTitle")} — EduSpark` };
}

async function NoCertificatesGate() {
  const t = await getTranslations("serviceForm.noCertificate");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 mx-auto">
          <Award className="w-10 h-10 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-3">
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("desc", { passingScore: QUIZ_PASSING_SCORE })}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/courses"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors"
          >
            <GraduationCap className="w-4 h-4" />
            {t("browseCourses")}
          </Link>
          <Link
            href="/dashboard/student"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent/80 text-foreground text-sm font-semibold transition-colors border border-border"
          >
            {t("myDashboard")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function NewServicePage() {
  const session = await getServerSession(authOptions);
  const locale = await getLocale();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/login`);
  }

  const { id: userId, role } = session.user;
  if (role !== Role.CREATOR && role !== Role.ADMIN) {
    redirect(`/${locale}/dashboard/student`);
  }

  const t = await getTranslations("serviceForm.newPage");
  const isAdmin = role === "ADMIN";

  const [certificates, adminCourses] = await Promise.all([
    db.certificate.findMany({
      where: { userId },
      select: {
        credentialId: true,
        score: true,
        course: {
          select: { id: true, title: true, level: true },
        },
      },
      orderBy: { issuedAt: "desc" },
    }),
    isAdmin
      ? db.course.findMany({
          where: { status: "PUBLISHED" },
          select: { id: true, title: true, level: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  if (!isAdmin && certificates.length === 0) {
    redirect(`/${locale}/unauthorized?from=/dashboard/creator/services/new`);
  }

  const certifiedCourses: CertifiedCourseOption[] = isAdmin
    ? adminCourses.map((c) => ({
        courseId: c.id,
        courseTitle: c.title,
        courseLevel: c.level,
        score: 100,
        credentialId: "ADMIN-ACCESS",
      }))
    : certificates.map((c) => ({
        courseId: c.course.id,
        courseTitle: c.course.title,
        courseLevel: c.course.level,
        score: c.score,
        credentialId: c.credentialId,
      }));

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {t("eyebrow")}
            </p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            {t("subtitle", { count: certifiedCourses.length })}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-800/80 dark:text-amber-300/80 text-xs leading-relaxed">
            <span className="font-semibold text-amber-800 dark:text-amber-300">
              {t("marketplaceRule")}{" "}
            </span>
            {t("marketplaceRuleText")}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        <ServiceCreationForm certifiedCourses={certifiedCourses} />
      </div>
    </div>
  );
}