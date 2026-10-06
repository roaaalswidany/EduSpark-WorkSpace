/* eslint-disable @typescript-eslint/no-unused-vars */
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Briefcase, Search } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";

export const metadata = {
  title: "My Projects — EduSpark",
};

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const userId = session.user.id;

  const projects = await db.project.findMany({
    where: {
      OR: [{ clientId: userId }, { creatorId: userId }],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      budget: true,
      deadline: true,
      clientId: true,
      creatorId: true,
      client: { select: { name: true, image: true } },
      creator: { select: { name: true, image: true } },
      _count: { select: { milestones: true } },
    },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-violet-400 mb-2">
          <Briefcase className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">Workspace</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
          My Projects
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          {projects.length === 0
            ? "No projects yet. Order a service or wait for a creator to accept your project."
            : `${projects.length} ${projects.length === 1 ? "project" : "projects"}`}
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-12 sm:p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-5">
            <Briefcase className="w-7 h-7 text-violet-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1.5">
            No projects yet
          </h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6 leading-relaxed">
            Projects are created automatically when you order a service from
            the marketplace.
          </p>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
          >
            <Search className="w-4 h-4" />
            Browse Services
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => {
            const isClient = p.clientId === userId;
            const counterpart = isClient ? p.creator : p.client;
            return (
              <Link
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                className="group flex items-center gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-violet-500/40 transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {p.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isClient ? "Client" : "Creator"} ·{" "}
                    {p._count.milestones} milestones ·{" "}
                    {p.status.replace("_", " ").toLowerCase()}
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                  {p.status.replace("_", " ")}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}