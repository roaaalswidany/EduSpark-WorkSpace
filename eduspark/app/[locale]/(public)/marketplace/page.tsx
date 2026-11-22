import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { ServiceStatus } from "@prisma/client";
import { CatalogClient } from "./_components/catalog-client";
import type {
  ServiceCardData,
  CategoryFilterOption,
} from "./_components/catalog-client";
import { cached } from "@/lib/cache";
import { CacheKeys, CacheTTL } from "@/lib/cache-keys";

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketplace.meta" });
  return {
    title: `${t("title")} — EduSpark`,
    description: t("description"),
  };
}

export default async function MarketplacePage() {
  const [rawServices, categories] = await Promise.all([
    cached(CacheKeys.servicesList({}), CacheTTL.medium, () =>
      db.service.findMany({
        where: { status: ServiceStatus.ACTIVE },
        select: {
          id: true, title: true, slug: true, description: true,
          thumbnail: true, price: true, deliveryDays: true,
          revisions: true, tags: true, portfolioLinks: true, createdAt: true,
          creator: {
            select: {
              id: true, name: true, headline: true,
              certificates: { select: { course: { select: { categoryId: true } } } },
            },
          },
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
    ),
    cached(CacheKeys.servicesCategories(), CacheTTL.long, () =>
      db.category.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      })
    ),
  ]);

  const services: ServiceCardData[] = rawServices.map((s) => ({
    ...s,
    price: Number(s.price),
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
    creator: {
      id: s.creator.id,
      name: s.creator.name,
      headline: s.creator.headline,
      certifiedCategories: (s.creator.certificates ?? [])
        .map((c) => c.course.categoryId)
        .filter((id): id is string => Boolean(id)),
    },
  }));
  const categoryOptions: CategoryFilterOption[] = categories;

  return <CatalogClient initialServices={services} categories={categoryOptions} />;
}