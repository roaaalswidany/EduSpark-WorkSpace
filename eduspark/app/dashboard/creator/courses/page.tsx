import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import Link from "next/link";
import { BookOpen, Settings, HelpCircle, GraduationCap } from "lucide-react";

export default async function CreatorCoursesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  // Fetch courses created by this user
  const courses = await db.course.findMany({
    where: { creatorId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      _count: { select: { enrollments: true } },
      quiz: { select: { _count: { select: { questions: true } } } },
    },
  });

  return (
    <div className="container mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-indigo-400" />
          My Courses
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your courses and certification quizzes.
        </p>
      </div>

      {courses.length === 0 ? (
        <div className="text-center p-12 bg-slate-900 border border-slate-800 rounded-xl text-slate-500">
          You haven&apos;t created any courses yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((course) => (
            <div
              key={course.id}
              className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-bold text-white line-clamp-1">
                    {course.title}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                    course.status === "PUBLISHED" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                  }`}>
                    {course.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    {course._count.enrollments} Students
                  </span>
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" />
                    {course.quiz?._count.questions ?? 0} Questions
                  </span>
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-slate-800 flex gap-2">
                <Link
                  href={`/dashboard/creator/courses/${course.id}/quiz`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Manage Quiz
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}