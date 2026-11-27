import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslations, getLocale } from "next-intl/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { ProfileView } from "./_components/profile-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "profile.page" });
  return { title: `${t("title")} — EduSpark` };
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  const locale = await getLocale();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/login`);
  }

  const userId = session.user.id;

  const [
    user,
    enrollmentsCount,
    certificatesCount,
    servicesCount,
    projectsCount,
  ] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        headline: true,
        bio: true,
        website: true,
        createdAt: true,
      },
    }),
    db.enrollment.count({ where: { userId } }),
    db.certificate.count({ where: { userId } }),
    db.service.count({ where: { creatorId: userId } }),
    db.project.count({
      where: {
        OR: [{ clientId: userId }, { creatorId: userId }],
      },
    }),
  ]);

  if (!user) redirect(`/${locale}/auth/login`);

  return (
    <ProfileView
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        image: null,
        role: user.role,
        headline: user.headline ?? "",
        bio: user.bio ?? "",
        website: user.website ?? "",
        createdAt: user.createdAt.toISOString(),
      }}
      stats={{
        enrollments: enrollmentsCount,
        certificates: certificatesCount,
        services: servicesCount,
        projects: projectsCount,
      }}
    />
  );
}