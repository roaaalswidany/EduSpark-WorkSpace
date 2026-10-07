import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { ServiceStatus } from "@prisma/client";
import { ServiceDetailView } from "./_components/service-detail-view";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const service = await db.service.findUnique({
    where: { slug },
    select: { title: true, description: true },
  });
  if (!service) return { title: "Service not found" };
  return {
    title: `${service.title} — EduSpark Marketplace`,
    description: service.description.slice(0, 160),
  };
}

export default async function ServiceDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await getServerSession(authOptions);

  const service = await db.service.findUnique({
    where: { slug },
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
      portfolioLinks: true,
      createdAt: true,
      creatorId: true,
      creator: {
        select: {
          id: true,
          name: true,
          image: true,
          headline: true,
          bio: true,
        },
      },
      category: {
        select: { id: true, name: true, slug: true },
      },
      _count: {
        select: { orders: true },
      },
    },
  });

  if (!service || service.status !== ServiceStatus.ACTIVE) notFound();

  // Check ownership
  const isOwnService = session?.user?.id === service.creatorId;
  const isLoggedIn = !!session?.user?.id;

  // Related services: same category, exclude self
  const relatedServices = service.category
    ? await db.service.findMany({
        where: {
          status: ServiceStatus.ACTIVE,
          categoryId: service.category.id,
          id: { not: service.id },
        },
        take: 4,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnail: true,
          price: true,
          deliveryDays: true,
          creator: { select: { name: true, image: true } },
        },
      })
    : [];

  return (
    <ServiceDetailView
      service={{
        id: service.id,
        title: service.title,
        slug: service.slug,
        description: service.description,
        thumbnail: service.thumbnail,
        price: Number(service.price),
        deliveryDays: service.deliveryDays,
        revisions: service.revisions,
        tags: service.tags,
        portfolioLinks: service.portfolioLinks,
        createdAt: service.createdAt.toISOString(),
        orderCount: service._count.orders,
        creator: service.creator,
        category: service.category,
      }}
      relatedServices={relatedServices.map((s) => ({
        ...s,
        price: Number(s.price),
      }))}
      isLoggedIn={isLoggedIn}
      isOwnService={isOwnService}
    />
  );
}