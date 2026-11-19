/* eslint-disable @typescript-eslint/no-unused-vars */
import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { GraduationCap, Award, ArrowLeft, Package } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { ServiceStatus } from "@prisma/client";
import { ProfileHeader } from "@/app/dashboard/profile/_components/profile-header";
import { PublicServicesGrid } from "./_components/public-services-grid";
import { CreatorReputationCard } from "@/components/reviews/creator-reputation-card";

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
    <div className="min-h-screen bg-background text-foreground">

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Back link */}
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to marketplace
        </Link>

        {/* Profile header */}
        <ProfileHeader
          user={{
            name: user.name,
            email: user.email,
            image: null,
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
          <div className="mt-6 rounded-2xl bg-card border border-border p-5 sm:p-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <Award className="w-3.5 h-3.5" />
              About
            </h2>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {user.bio}
            </p>
          </div>
        )}

        <CreatorReputationCard creatorId={userId} />

        {/* Services */}
        {services.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Services Offered
              </h2>
              <span className="text-xs text-muted-foreground">
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