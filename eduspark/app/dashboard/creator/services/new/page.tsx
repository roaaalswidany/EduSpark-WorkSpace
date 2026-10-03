import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { ServiceCreationForm } from "./_components/service-creation-form";
import { GraduationCap, Award, AlertCircle } from "lucide-react";
import Link from "next/link";

// ─── Types passed to client ───────────────────────────────────────────────────

export interface CertifiedCourseOption {
  courseId: string;
  courseTitle: string;
  courseLevel: string;
  score: number;
  credentialId: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function NoCertificatesGate() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 mx-auto">
          <Award className="w-10 h-10 text-amber-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-3">
            Certificate Required
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            To offer services on EduSpark, you must first complete a course and
            pass the certification quiz with a score of{" "}
            <span className="text-white font-semibold">80% or higher</span>.
            Your certificate proves your expertise to potential clients.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/marketplace/courses"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
          >
            <GraduationCap className="w-4 h-4" />
            Browse Courses
          </Link>
          <Link
            href="/dashboard/student"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors border border-slate-700"
          >
            My Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function NewServicePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const { id: userId, role } = session.user;

  if (role !== Role.CREATOR && role !== Role.ADMIN) {
    redirect("/dashboard/student");
  }

  // Fetch in parallel: certified courses + all categories
  const [certificates, categories] = await Promise.all([
    db.certificate.findMany({
      where: { userId },
      select: {
        credentialId: true,
        score: true,
        course: {
          select: {
            id: true,
            title: true,
            level: true,
          },
        },
      },
      orderBy: { issuedAt: "desc" },
    }),
    db.category.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (certificates.length === 0) {
    return <NoCertificatesGate />;
  }

  const certifiedCourses: CertifiedCourseOption[] = certificates.map((c) => ({
    courseId: c.course.id,
    courseTitle: c.course.title,
    courseLevel: c.course.level,
    score: c.score,
    credentialId: c.credentialId,
  }));

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Page header */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Creator Studio
            </p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Create a New Service
          </h1>
          <p className="text-slate-400 text-sm mt-1.5">
            You have{" "}
            <span className="text-amber-400 font-semibold">
              {certifiedCourses.length} certified{" "}
              {certifiedCourses.length === 1 ? "course" : "courses"}
            </span>{" "}
            available for service creation.
          </p>
        </div>
      </div>

      {/* Alert: marketplace rule */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-300/80 text-xs leading-relaxed">
            <span className="font-semibold text-amber-300">
              Marketplace Rule:{" "}
            </span>
            Each service must be linked to a course you have officially
            certified in. This ensures buyers receive expertise that is
            independently verified by EduSpark.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        <ServiceCreationForm
          certifiedCourses={certifiedCourses}
          categories={categories}
        />
      </div>
    </div>
  );
}