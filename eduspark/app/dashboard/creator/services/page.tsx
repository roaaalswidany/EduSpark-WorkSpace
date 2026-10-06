import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { CreatorServicesHeader } from "./_components/creator-services-header";
import { CreatorServiceCard } from "./_components/creator-service-card";
import { EmptyServicesState } from "./_components/empty-services-state";

export const metadata = {
  title: "My Services — EduSpark",
};

export default async function CreatorServicesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const { id: userId, role } = session.user;
  if (role !== Role.CREATOR && role !== Role.ADMIN) {
    redirect("/dashboard/student");
  }

  const services = await db.service.findMany({
    where: { creatorId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      thumbnail: true,
      price: true,
      deliveryDays: true,
      revisions: true,
      status: true,
      tags: true,
      createdAt: true,
      category: { select: { id: true, name: true, slug: true } },
      _count: { select: { orders: true, projects: true } },
    },
  });

  const serialized = services.map((s) => ({
    ...s,
    price: Number(s.price),
    createdAt: s.createdAt.toISOString(),
  }));

  const stats = {
    total: services.length,
    active: services.filter((s) => s.status === "ACTIVE").length,
    totalOrders: services.reduce((acc, s) => acc + s._count.orders, 0),
    totalProjects: services.reduce((acc, s) => acc + s._count.projects, 0),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <CreatorServicesHeader stats={stats} />

      {serialized.length === 0 ? (
        <EmptyServicesState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {serialized.map((service) => (
            <CreatorServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </div>
  );
}