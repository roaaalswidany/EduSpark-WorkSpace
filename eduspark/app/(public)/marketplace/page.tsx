import { db } from "@/lib/db";
import { ServiceStatus } from "@prisma/client";
import { CatalogClient } from "./_components/catalog-client";
import type {
  ServiceCardData,
  CategoryFilterOption,
} from "./_components/catalog-client";
import { cached } from "@/lib/cache";
import { CacheKeys, CacheTTL } from "@/lib/cache-keys";

// ISR: revalidate catalog every 60 seconds
export const revalidate = 60;

export const metadata = {
  title: "Marketplace — EduSpark",
  description:
    "Hire certified experts who have proven their skills through EduSpark's rigorous course program.",
};

export default async function MarketplacePage() {
  // ── Fetch with caching ─────────────────────────────────
  const [rawServices, categories] = await Promise.all([
    // Cache: all active services (60s TTL)
    cached(CacheKeys.servicesList({}), CacheTTL.medium, () =>
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
      })
    ),

    // Cache: categories (5 min TTL)
    cached(CacheKeys.servicesCategories(), CacheTTL.long, () =>
      db.category.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      })
    ),
  ]);

  // Serialize Prisma Decimal → plain number for client component hydration
  // NOTE: When the data comes from Redis cache, createdAt is already a
  // string (JSON.parse turns Date into string). When it comes fresh from
  // Prisma, it's a Date object. Handle both cases.
  const services: ServiceCardData[] = rawServices.map((s) => ({
    ...s,
    price: Number(s.price),
    createdAt:
      s.createdAt instanceof Date
        ? s.createdAt.toISOString()
        : String(s.createdAt),
  }));

  const categoryOptions: CategoryFilterOption[] = categories;

  return (
    <CatalogClient initialServices={services} categories={categoryOptions} />
  );
}