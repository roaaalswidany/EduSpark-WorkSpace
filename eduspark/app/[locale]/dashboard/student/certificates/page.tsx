import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Award, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation"; // 👈 تم التعديل للـ i18n
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { CertificateCard } from "@/components/lms/CertificateCard";

export default async function MyCertificatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const t = await getTranslations("studentCertificates");

  // Build the base URL from request headers (works for any host)
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  const certificates = await db.certificate.findMany({
    where: { userId: session.user.id },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      credentialId: true,
      score: true,
      issuedAt: true,
      courseId: true,
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          level: true,
          category: { select: { name: true } },
          creator: { select: { name: true } },
        },
      },
    },
  });

  const data = certificates.map((c) => ({
    id: c.id,
    credentialId: c.credentialId,
    score: c.score,
    issuedAt: c.issuedAt,
    courseId: c.courseId,
    courseTitle: c.course.title,
    courseSlug: c.course.slug,
    courseLevel: c.course.level,
    categoryName: c.course.category?.name ?? null,
    recipientName: session.user.name ?? "Student",
    instructorName: c.course.creator.name,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 mb-2">
          <Award className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">{t("achievements")}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground tracking-tight">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {data.length === 0 ? t("descEmpty") : t("earned", { count: data.length })}
        </p>
      </div>

      {/* Empty state */}
      {data.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-12 sm:p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-600 dark:bg-amber-500/10 border border-amber-600 dark:border-amber-500/20 flex items-center justify-center mx-auto mb-5">
            <Award className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1.5">
            {t("noCertsTitle")}
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6 leading-relaxed">
            {t("noCertsDesc")}
          </p>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary text-primary-foreground text-sm font-bold transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
          >
            <Search className="w-4 h-4 rtl:rotate-180" />
            {t("browseCourses")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {data.map((cert) => (
            <CertificateCard
              key={cert.id}
              certificate={cert}
              variant="full"
              verifyBaseUrl={baseUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}