/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import ChatBox from "@/components/chat/ChatBox";
import { cn } from "@/lib/utils";

const STATUS_KEY_MAP: Record<string, string> = {
  PENDING: "pending",
  OPEN: "open",
  IN_PROGRESS: "inProgress",
  REVIEW_REQUESTED: "reviewRequested",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  DISPUTED: "disputed",
};

interface ProjectChatPageProps {
  params: Promise<{ locale: string; projectId: string }>;
}

export async function generateMetadata({
  params,
}: ProjectChatPageProps): Promise<Metadata> {
  const { projectId, locale } = await params;
  const t = await getTranslations({ locale, namespace: "projects.chatPage" });
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { title: true },
  });
  return {
    title: project ? `${project.title} — Chat | EduSpark` : "Project Chat | EduSpark",
    description: t("endToEndEncrypted"),
    robots: { index: false, follow: false },
  };
}

export default async function ProjectChatPage({
  params,
}: ProjectChatPageProps): Promise<React.ReactElement> {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  const locale = await getLocale();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/login`);
  }

  const t = await getTranslations("projects.chatPage");
  const tStatus = await getTranslations("projects.statuses");

  const { id: userId, name: userName, image: userImage } = session.user;

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      status: true,
      clientId: true,
      creatorId: true,
      client: { select: { id: true, name: true, image: true } },
      creator: { select: { id: true, name: true, image: true } },
      chatRoom: { select: { id: true } },
    },
  });

  if (!project) notFound();

  const isClient = project.clientId === userId;
  const isCreator = project.creatorId === userId;

  if (!isClient && !isCreator) {
    redirect(`/${locale}/dashboard/projects`);
  }

  if (!project.chatRoom) {
    notFound();
  }

  const roomId = `chat:${project.chatRoom.id}`;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Back navigation */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-card/70 border-b border-border/80">
        <Link
          href={`/dashboard/projects/${project.id}`}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform rtl:rotate-180 rtl:group-hover:translate-x-0.5" />
          <span>{t("back")}</span>
        </Link>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span className="hidden sm:inline">{t("endToEndEncrypted")}</span>
          <span className="sm:hidden">{t("secure")}</span>
        </div>
      </div>

      {/* Participants header */}
      <div className="shrink-0 flex items-center gap-4 px-4 py-2.5 bg-card/40 border-b border-border/60">
        <div className="flex items-center gap-3">
          <ParticipantChip
            user={project.client}
            label={t("client")}
            isCurrentUser={project.clientId === userId}
            youLabel={t("you")}
          />
          <span className="text-muted-foreground text-xs">↔</span>
          {project.creator ? (
            <ParticipantChip
              user={project.creator}
              label={t("creator")}
              isCurrentUser={project.creatorId === userId}
              youLabel={t("you")}
            />
          ) : (
            <span className="text-xs text-muted-foreground italic">
              {t("noCreator")}
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide border",
              project.status === "COMPLETED"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : project.status === "IN_PROGRESS"
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-accent text-muted-foreground border-border"
            )}
          >
            {tStatus(STATUS_KEY_MAP[project.status] as any)}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ChatBox
          roomId={roomId}
          chatType="PROJECT"
          roomName={project.title}
          currentUser={{
            id: userId,
            name: userName ?? "Unknown",
            image: userImage ?? null,
          }}
          showLegalDisclaimer
        />
      </div>
    </div>
  );
}

// ─── Participant chip ─────────────────────────────────────────────────────────

function ParticipantChip({
  user,
  label,
  isCurrentUser,
  youLabel,
}: {
  user: { id: string; name: string; image: string | null };
  label: string;
  isCurrentUser: boolean;
  youLabel: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative shrink-0 w-6 h-6">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.name}
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-accent text-foreground text-[9px] font-bold">
            {user.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-foreground leading-none">
          {user.name}
          {isCurrentUser && (
            <span className="ml-1 text-[10px] text-primary">{youLabel}</span>
          )}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}