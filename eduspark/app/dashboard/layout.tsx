import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { UserMenu } from "@/components/auth/UserMenu";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="text-sm font-bold text-white">EduSpark</span>
          </Link>

          {/* User menu */}
          <UserMenu user={session.user} />
        </div>
      </header>

      {/* Main content */}
      <main>{children}</main>
    </div>
  );
}