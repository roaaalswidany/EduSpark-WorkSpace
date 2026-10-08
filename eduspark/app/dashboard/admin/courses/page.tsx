import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { GraduationCap } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { CoursesTable } from "./_components/courses-table";

export const metadata = {
  title: "Courses — Admin — EduSpark",
};

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}

export default async function AdminCoursesPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where = {
    ...(sp.q && {
      OR: [
        { title: { contains: sp.q, mode: "insensitive" as const } },
        { description: { contains: sp.q, mode: "insensitive" as const } },
      ],
    }),
    ...(sp.status && {
      status: sp.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
    }),
  };

  const [courses, total, statusCounts] = await Promise.all([
    db.course.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        slug: true,
        thumbnail: true,
        status: true,
        level: true,
        price: true,
        createdAt: true,
        creator: {
          select: { id: true, name: true, image: true },
        },
        category: {
          select: { id: true, name: true },
        },
        _count: {
          select: { enrollments: true, sections: true },
        },
      },
    }),
    db.course.count({ where }),
    db.course.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const counts = {
    DRAFT: statusCounts.find((s) => s.status === "DRAFT")?._count._all ?? 0,
    PUBLISHED:
      statusCounts.find((s) => s.status === "PUBLISHED")?._count._all ?? 0,
    ARCHIVED:
      statusCounts.find((s) => s.status === "ARCHIVED")?._count._all ?? 0,
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-2">
          <GraduationCap className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">Admin</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
          Courses
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Review, publish, or archive courses across the platform.
        </p>
      </div>

      <CoursesTable
        courses={courses.map((c) => ({
          ...c,
          price: Number(c.price),
          createdAt: c.createdAt.toISOString(),
        }))}
        statusCounts={counts}
        initialQuery={sp.q ?? ""}
        initialStatus={sp.status ?? ""}
        total={total}
        currentPage={page}
        totalPages={totalPages}
      />
    </div>
  );
}