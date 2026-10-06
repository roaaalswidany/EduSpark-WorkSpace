import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { GraduationCap, Award, ArrowLeft, Package } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { ServiceStatus } from "@prisma/client";
import { ProfileHeader } from "@/app/dashboard/profile/_components/profile-header";
import { PublicServicesGrid } from "./_components/public-services-grid";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { userId } = await params;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, headline: true },
  });
  if (!user) return { title: "User not found — EduSpark" };
  return {
    title: `${user.name} — EduSpark`,
    description: user.headline ?? `${user.name}'s profile on EduSpark`,
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { userId } = await params;
  const session = await getServerSession(authOptions);
  const currentUserId = session?.user?.id;

  const [
    user,
    enrollmentsCount,
    certificatesCount,
    activeServicesCount,
    projectsCount,
    services,
  ] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        headline: true,
        bio: true,
        website: true,
        createdAt: true,
        isActive: true,
      },
    }),
    db.enrollment.count({ where: { userId } }),
    db.certificate.count({ where: { userId } }),
    db.service.count({
      where: { creatorId: userId, status: ServiceStatus.ACTIVE },
    }),
    db.project.count({
      where: { OR: [{ clientId: userId }, { creatorId: userId }] },
    }),
    db.service.findMany({
      where: { creatorId: userId, status: ServiceStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        slug: true,
        thumbnail: true,
        price: true,
        deliveryDays: true,
        _count: { select: { orders: true } },
      },
    }),
  ]);

  if (!user || !user.isActive) notFound();

  const isOwner = currentUserId === user.id;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top bar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="text-sm font-bold text-white">EduSpark</span>
          </Link>

          <div className="flex items-center gap-2">
            {isOwner && (
              <Link
                href="/dashboard/profile"
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
              >
                Edit Profile
              </Link>
            )}
            <Link
              href="/marketplace"
              className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs font-semibold transition-colors"
            >
              Marketplace
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Back link */}
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to marketplace
        </Link>

        {/* Profile header */}
        <ProfileHeader
          user={{
            name: user.name,
            email: user.email,
            image: user.image,
            role: user.role,
            headline: user.headline ?? "",
            website: user.website ?? "",
            createdAt: user.createdAt.toISOString(),
          }}
          stats={{
            enrollments: enrollmentsCount,
            certificates: certificatesCount,
            services: activeServicesCount,
            projects: projectsCount,
          }}
        />

        {/* Bio */}
        {user.bio && (
          <div className="mt-6 rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
              <Award className="w-3.5 h-3.5" />
              About
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
              {user.bio}
            </p>
          </div>
        )}

        {/* Services */}
        {services.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-400" />
                Services Offered
              </h2>
              <span className="text-xs text-slate-600">
                {activeServicesCount}{" "}
                {activeServicesCount === 1 ? "service" : "services"}
              </span>
            </div>
            <PublicServicesGrid
              services={services.map((s) => ({
                ...s,
                price: Number(s.price),
              }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}