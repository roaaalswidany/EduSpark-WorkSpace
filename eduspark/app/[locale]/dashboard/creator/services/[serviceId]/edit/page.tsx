import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { GraduationCap, ArrowLeft, Pencil } from "lucide-react";
import { ServiceCreationForm } from "../../new/_components/service-creation-form";
import type { CertifiedCourseOption } from "../../new/page";
import { ServiceThumbnailUploader } from "../../_components/service-thumbnail-uploader";

interface PageProps {
  params: Promise<{ locale: string; serviceId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "serviceForm.editPage" });
  return { title: `${t("metadataTitle")} — EduSpark` };
}

export default async function EditServicePage({ params }: PageProps) {
  const { serviceId } = await params;
  const session = await getServerSession(authOptions);
  const locale = await getLocale();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/login`);
  }

  const { id: userId, role } = session.user;
  if (role !== Role.CREATOR && role !== Role.ADMIN) {
    redirect(`/${locale}/dashboard/student`);
  }

  const t = await getTranslations("serviceForm.editPage");

  const [service, certificates] = await Promise.all([
    db.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        thumbnail: true,
        price: true,
        deliveryDays: true,
        revisions: true,
        tags: true,
        portfolioLinks: true,
        creatorId: true,
        categoryId: true,
      },
    }),
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
  ]);

  if (!service) notFound();
  if (service.creatorId !== userId) notFound();

  const certifiedCourses: CertifiedCourseOption[] = certificates.map((c) => ({
    courseId: c.course.id,
    courseTitle: c.course.title,
    courseLevel: c.course.level,
    score: c.score,
    credentialId: c.credentialId,
  }));

  const defaultCourseId = certifiedCourses[0]?.courseId ?? "";

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <Link
            href="/dashboard/creator/services"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            {t("back")}
          </Link>

          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Pencil className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {t("eyebrow")}
            </p>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-foreground">
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5 truncate">
            {service.title}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 space-y-6">
        <ServiceThumbnailUploader
          serviceId={service.id}
          currentThumbnail={service.thumbnail}
        />

        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <GraduationCap className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-800/80 dark:text-amber-300/80 text-xs leading-relaxed">
            <span className="font-semibold text-amber-800 dark:text-amber-300">
              {t("note")}{" "}
            </span>
            {t("noteText")}
          </p>
        </div>

        <ServiceCreationForm
          mode="edit"
          serviceId={service.id}
          certifiedCourses={certifiedCourses}
          initialData={{
            courseId: defaultCourseId,
            categoryId: service.categoryId,
            title: service.title,
            description: service.description,
            price: Number(service.price),
            deliveryDays: service.deliveryDays,
            revisions: service.revisions,
            tags: service.tags,
            portfolioLinks: service.portfolioLinks,
          }}
        />
      </div>
    </div>
  );
}