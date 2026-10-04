import Link from "next/link";
import { GraduationCap, ArrowRight } from "lucide-react";

export default function WelcomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <GraduationCap className="w-7 h-7 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          Welcome to EduSpark! 🎉
        </h1>
        <p className="text-slate-400 mb-6">
          Your account is ready. Start exploring courses and building your
          skills.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
        >
          Go to dashboard
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}