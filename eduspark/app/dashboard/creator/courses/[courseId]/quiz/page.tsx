import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { QuizGenerator } from "./_components/quiz-generator";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const { courseId } = await params;

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      creatorId: true,
      quiz: {
        select: {
          id: true,
          questions: {
            select: { id: true, text: true, status: true },
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });

  if (!course) redirect("/dashboard");
  if (course.creatorId !== session.user.id && session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/creator/courses"
          className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to My Courses
        </Link>
        <h1 className="text-2xl font-bold text-white">Quiz Management</h1>
        <p className="text-sm text-slate-400 mt-1">Course: {course.title}</p>
      </div>

      {/* Generator / Form */}
      <QuizGenerator courseId={course.id} />

      {/* Existing Questions List */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-white mb-4">
          Current Questions ({course.quiz?.questions.length ?? 0})
        </h2>
        
        {!course.quiz || course.quiz.questions.length === 0 ? (
          <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 text-sm">
            No questions yet. Use the tools above to add questions.
          </div>
        ) : (
          <div className="space-y-3">
            {course.quiz.questions.map((q, i) => (
              <div key={q.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-xs font-bold text-slate-400 shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 leading-relaxed">{q.text}</p>
                    <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      q.status === "PUBLISHED" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                    }`}>
                      {q.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}