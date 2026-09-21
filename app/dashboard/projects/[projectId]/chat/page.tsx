import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import ChatBox from "@/components/chat/ChatBox";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

// ─── Page metadata ────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { projectId: string };
}): Promise<Metadata> {
  const project = await db.project.findUnique({
    where: { id: params.projectId },
    select: { title: true },
  });

  return {
    title: project ? `${project.title} — Chat | EduSpark` : "Project Chat | EduSpark",
    description: "Secure, legally-recorded project communication channel.",
    robots: { index: false, follow: false }, // Private page
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface ProjectChatPageProps {
  params: { projectId: string };
}

export default async function ProjectChatPage({
  params,
}: ProjectChatPageProps): Promise<React.ReactElement> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const { id: userId, name: userName, image: userImage } = session.user;

  // Fetch project with participants and chatRoom in a single query
  const project = await db.project.findUnique({
    where: { id: params.projectId },
    select: {
      id: true,
      title: true,
      status: true,
      clientId: true,
      creatorId: true,
      client: {
        select: { id: true, name: true, image: true },
      },
      creator: {
        select: { id: true, name: true, image: true },
      },
      chatRoom: {
        select: { id: true },
      },
    },
  });

  if (!project) notFound();

  // Access control: only project client and creator may access this chat
  const isClient = project.clientId === userId;
  const isCreator = project.creatorId === userId;

  if (!isClient && !isCreator) {
    redirect("/dashboard/projects");
  }

  // Projects must have a chat room (created at order time via order-service action)
  if (!project.chatRoom) {
    notFound();
  }

  // The room ID format understood by the chat server: "chat:{chatRoomId}"
  const roomId = `chat:${project.chatRoom.id}`;

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* ── Back navigation ──────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-slate-900/70 border-b border-slate-800/80">
        <Link
          href={`/dashboard/projects/${project.id}`}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Project</span>
        </Link>

        {/* Security badge */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span className="hidden sm:inline">End-to-end encrypted channel</span>
          <span className="sm:hidden">Secure</span>
        </div>
      </div>

      {/* ── Participants header ───────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-4 px-4 py-2.5 bg-slate-900/40 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <ParticipantChip
            user={project.client}
            label="Client"
            isCurrentUser={project.clientId === userId}
          />
          <span className="text-slate-700 text-xs">↔</span>
          {project.creator ? (
            <ParticipantChip
              user={project.creator}
              label="Creator"
              isCurrentUser={project.creatorId === userId}
            />
          ) : (
            <span className="text-xs text-slate-600 italic">Creator not assigned</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide",
              project.status === "COMPLETED"
                ? "bg-emerald-500/10 text-emerald-400"
                : project.status === "IN_PROGRESS"
                ? "bg-indigo-500/10 text-indigo-400"
                : "bg-slate-800 text-slate-500"
            )}
          >
            {project.status.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* ── Chat box ─────────────────────────────────────────────────────────── */}
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
}: {
  user: { id: string; name: string; image: string | null };
  label: string;
  isCurrentUser: boolean;
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
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center bg-slate-700 text-white text-[9px] font-bold"
          >
            {user.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-300 leading-none">
          {user.name}
          {isCurrentUser && (
            <span className="ml-1 text-[10px] text-indigo-400">(you)</span>
          )}
        </p>
        <p className="text-[10px] text-slate-600 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── cn utility (inline to avoid import issues) ───────────────────────────────

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}