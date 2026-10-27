import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { Footer } from "@/components/layout/footer"; 

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
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <PublicNavbar user={user} />
      <main className="flex-1">{children}</main>
      <Footer /> 
    </div>
  );
}