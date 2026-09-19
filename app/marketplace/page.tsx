import { db } from "@/lib/db";
import { ServiceStatus } from "@prisma/client";
import { CatalogClient } from "./_components/catalog-client";
import type { ServiceCardData, CategoryFilterOption } from "./_components/catalog-client";

// ISR: revalidate catalog every 60 seconds
export const revalidate = 60;

export const metadata = {
  title: "Marketplace — EduSpark",
  description:
    "Hire certified experts who have proven their skills through EduSpark's rigorous course program.",
};

export default async function MarketplacePage() {
  const [rawServices, categories] = await Promise.all([
    db.service.findMany({
      where: { status: ServiceStatus.ACTIVE },
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
        createdAt: true,
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
            headline: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: { orders: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.category.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Serialize Prisma Decimal → plain number for client component hydration
  const services: ServiceCardData[] = rawServices.map((s) => ({
    ...s,
    price: Number(s.price),
    createdAt: s.createdAt.toISOString(),
  }));

  const categoryOptions: CategoryFilterOption[] = categories;

  return (
    <CatalogClient initialServices={services} categories={categoryOptions} />
  );
}