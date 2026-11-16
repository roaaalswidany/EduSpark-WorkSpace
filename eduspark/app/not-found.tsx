import Link from "next/link";
import { Home, Search, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Page Not Found â€” EduSpark",
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Big 404 */}
        <div className="relative mb-8">
          <h1 className="text-[120px] font-black text-slate-800 leading-none select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center backdrop-blur-sm">
              <Search className="w-9 h-9 text-primary" />
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">
          Page Not Found
        </h2>
        <p className="text-muted-foreground mb-8 text-sm leading-relaxed max-w-sm mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back on track.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary text-primary-foreground text-sm font-semibold transition-colors w-full sm:w-auto justify-center"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-card border border-border hover:border-border text-foreground hover:text-foreground text-sm font-semibold transition-colors w-full sm:w-auto justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
            Browse Courses
          </Link>
        </div>
      </div>
    </div>
  );
}