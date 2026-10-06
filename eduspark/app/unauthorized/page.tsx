import Link from "next/link";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";

export const metadata = {
  title: "Access Denied — EduSpark",
};

interface PageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function UnauthorizedPage({ searchParams }: PageProps) {
  const { from } = await searchParams;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 mx-auto mb-5">
          <ShieldAlert className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          Access Denied
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          You don&apos;t have permission to access this page. This may be because
          you need a verified certificate, a higher role, or an active session.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all active:scale-95"
          >
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Link>
          {from && (
            <Link
              href="/courses"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Browse Courses
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}