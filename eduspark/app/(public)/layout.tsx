import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { PublicNavbar } from "@/components/layout/public-navbar";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  let user: { id: string; name: string; image: string | null } | null = null;

  if (session?.user?.id) {
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, image: true },
    });

    if (dbUser) {
      user = dbUser;
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <PublicNavbar user={user} />
      <main>{children}</main>
    </div>
  );
}