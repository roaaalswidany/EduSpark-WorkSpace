import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { GraduationCap, ArrowLeft, Pencil } from "lucide-react";
import { ServiceCreationForm } from "../../new/_components/service-creation-form";
import type {
  CertifiedCourseOption,
  CategoryOption,
} from "../../new/page";

interface PageProps {
  params: Promise<{ serviceId: string }>;
}

export const metadata = {
  title: "Edit Service — EduSpark",
};

export default async function EditServicePage({ params }: PageProps) {
  const { serviceId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const { id: userId, role } = session.user;
  if (role !== Role.CREATOR && role !== Role.ADMIN) {
    redirect("/dashboard/student");
  }

  const [service, certificates, categories] = await Promise.all([
    db.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
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
    db.category.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
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

  const categoryOptions: CategoryOption[] = categories;
  const defaultCourseId = certifiedCourses[0]?.courseId ?? "";

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <Link
            href="/dashboard/creator/services"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to My Services
          </Link>

          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Pencil className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Creator Studio
            </p>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Edit Service
          </h1>
          <p className="text-slate-400 text-sm mt-1.5 truncate">
            {service.title}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
          <GraduationCap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-300/80 text-xs leading-relaxed">
            <span className="font-semibold text-amber-300">Note: </span>
            Changes to your service will appear on the marketplace immediately.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        <ServiceCreationForm
          mode="edit"
          serviceId={service.id}
          certifiedCourses={certifiedCourses}
          categories={categoryOptions}
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