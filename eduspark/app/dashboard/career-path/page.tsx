import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { CareerPathView } from "./_components/career-path-view";

export const metadata = {
  title: "Career Path — EduSpark",
};

export default async function CareerPathPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const userId = session.user.id;

  const activePath = await db.careerPath.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      steps: {
        orderBy: { order: "asc" },
        include: {
          course: {
            select: { id: true, title: true, slug: true, level: true },
          },
        },
      },
    },
  });

  // Serialize for client component
  const serializedPath = activePath
    ? {
        id: activePath.id,
        goal: activePath.goal,
        level: activePath.level,
        description: activePath.description,
        estimatedWeeks: activePath.estimatedWeeks,
        status: activePath.status,
        createdAt: activePath.createdAt.toISOString(),
        steps: activePath.steps.map((s) => ({
          id: s.id,
          order: s.order,
          title: s.title,
          description: s.description,
          estimatedWeeks: s.estimatedWeeks,
          skills: s.skills,
          status: s.status,
          completedAt: s.completedAt?.toISOString() ?? null,
          course: s.course,
        })),
      }
    : null;

  return <CareerPathView activePath={serializedPath} />;
}