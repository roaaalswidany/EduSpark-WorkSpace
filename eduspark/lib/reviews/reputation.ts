import { db } from "@/lib/db";

export interface RatingSummary {
  average: number | null; // 1 decimal, null when there are no reviews
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

type Where = { creatorId: string } | { serviceId: string };

async function summarize(where: Where): Promise<RatingSummary> {
  const rows = await db.projectReview.groupBy({
    by: ["rating"],
    where,
    _count: { _all: true },
  });
  const distribution: RatingSummary["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0;
  let sum = 0;
  for (const r of rows) {
    if (r.rating >= 1 && r.rating <= 5) {
      distribution[r.rating as 1 | 2 | 3 | 4 | 5] = r._count._all;
      count += r._count._all;
      sum += r.rating * r._count._all;
    }
  }
  return { average: count ? Math.round((sum / count) * 10) / 10 : null, count, distribution };
}

export const getCreatorRating = (creatorId: string) => summarize({ creatorId });
export const getServiceRating = (serviceId: string) => summarize({ serviceId });

export const getCreatorCompletedProjects = (creatorId: string) =>
  db.project.count({ where: { creatorId, status: "COMPLETED" } });

export async function getServiceReviews(serviceId: string, take = 10) {
  return db.projectReview.findMany({
    where: { serviceId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      reviewer: { select: { name: true, image: true } },
    },
  });
}
