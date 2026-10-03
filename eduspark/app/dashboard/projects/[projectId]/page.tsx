import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { ProjectView } from "./_components/project-view";
import type { SerializedProject } from "./_components/project-view";

interface ProjectPageProps {
  params: { projectId: string };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const { id: userId } = session.user;

  const project = await db.project.findUnique({
    where: { id: params.projectId },
    select: {
      id: true,
      title: true,
      description: true,
      budget: true,
      deadline: true,
      status: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
      clientId: true,
      creatorId: true,
      serviceId: true,
      client: {
        select: { id: true, name: true, image: true, email: true },
      },
      creator: {
        select: { id: true, name: true, image: true, headline: true },
      },
      service: {
        select: {
          id: true,
          title: true,
          slug: true,
          price: true,
          deliveryDays: true,
        },
      },
      milestones: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          dueDate: true,
          status: true,
          order: true,
          amount: true,
          completedAt: true,
          revisionNote: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      chatRoom: {
        select: {
          id: true,
          _count: { select: { messages: true } },
        },
      },
    },
  });

  if (!project) notFound();

  // Access control: only client and creator may view this project
  const isClient = project.clientId === userId;
  const isCreator = project.creatorId === userId;

  if (!isClient && !isCreator) {
    redirect("/dashboard/projects");
  }

  // ── Serialize Prisma Decimal + Date values for the Client Component ─────────
  const serialized: SerializedProject = {
    id: project.id,
    title: project.title,
    description: project.description,
    budget: project.budget ? Number(project.budget) : null,
    deadline: project.deadline?.toISOString() ?? null,
    status: project.status,
    tags: project.tags,
    createdAt: project.createdAt.toISOString(),
    clientId: project.clientId,
    creatorId: project.creatorId,
    client: project.client,
    creator: project.creator,
    service: project.service
      ? {
          ...project.service,
          price: Number(project.service.price),
        }
      : null,
    milestones: project.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      dueDate: m.dueDate?.toISOString() ?? null,
      status: m.status,
      order: m.order,
      amount: m.amount ? Number(m.amount) : null,
      completedAt: m.completedAt?.toISOString() ?? null,
      revisionNote: m.revisionNote,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
    chatRoom: project.chatRoom
      ? {
          id: project.chatRoom.id,
          messageCount: project.chatRoom._count.messages,
        }
      : null,
  };

  return (
    <ProjectView
      project={serialized}
      currentUserId={userId}
      isClient={isClient}
      isCreator={isCreator}
    />
  );
}