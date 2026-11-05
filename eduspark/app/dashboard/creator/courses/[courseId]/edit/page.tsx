import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { CurriculumEditor } from "./_components/curriculum-editor";

export const metadata = { title: "Edit Course — EduSpark" };

interface PageProps {
  params: Promise<{ courseId: string }>;
}

export default async function EditCoursePage({ params }: PageProps) {
  const { courseId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      reviewNote: true,
      creatorId: true,
      _count: { select: { enrollments: true } },
      sections: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          order: true,
          lessons: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              description: true,
              videoUrl: true,
              duration: true,
              isFree: true,
              order: true,
              attachments: {
                select: {
                  id: true,
                  fileName: true,
                  fileSizeBytes: true,
                  mimeType: true,
                  status: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!course) notFound();
  if (
    course.creatorId !== session.user.id &&
    session.user.role !== Role.ADMIN
  ) {
    redirect("/unauthorized");
  }

  return (
    <CurriculumEditor
      course={{
        id: course.id,
        title: course.title,
        slug: course.slug,
        status: course.status,
        reviewNote: course.reviewNote,
        enrollmentCount: course._count.enrollments,
      }}
      sections={course.sections}
    />
  );
}