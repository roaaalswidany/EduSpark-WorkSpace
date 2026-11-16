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
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-destructive/10 border border-destructive/20 mx-auto mb-5">
          <ShieldAlert className="w-10 h-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          Access Denied
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          You don&apos;t have permission to access this page. This may be because
          you need a verified certificate, a higher role, or an active session.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary text-primary-foreground text-sm font-bold transition-all active:scale-95"
          >
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Link>
          {from && (
            <Link
              href="/courses"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent text-foreground text-sm font-semibold border border-border transition-all"
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