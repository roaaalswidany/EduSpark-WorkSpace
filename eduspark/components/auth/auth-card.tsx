import Link from "next/link";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="block text-center text-2xl font-bold text-primary mb-7">
          EduSpark
        </Link>
        <div className="rounded-2xl bg-card border border-border p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1.5 mb-6">{subtitle}</p>}
          {!subtitle && <div className="mb-6" />}
          {children}
        </div>
      </div>
    </div>
  );
}

export const inputClass =
  "w-full h-11 px-3 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 transition-all";
export const buttonClass =
  "w-full h-11 rounded-lg bg-primary hover:bg-primary text-primary-foreground font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
