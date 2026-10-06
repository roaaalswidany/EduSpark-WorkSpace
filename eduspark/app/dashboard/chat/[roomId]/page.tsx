import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import ChatBox from "@/components/chat/ChatBox";

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { roomId } = await params;
  const room = await db.chatRoom.findUnique({
    where: { id: roomId },
    select: { project: { select: { title: true } } },
  });
  return {
    title: room?.project?.title
      ? `${room.project.title} — Chat`
      : "Chat — EduSpark",
    robots: { index: false, follow: false },
  };
}

export default async function ChatRoomPage({ params }: PageProps) {
  const { roomId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const userId = session.user.id;

  // Verify room exists + user is participant
  const room = await db.chatRoom.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      type: true,
      project: {
        select: { id: true, title: true, status: true },
      },
      participants: {
        select: {
          user: {
            select: { id: true, name: true, image: true, role: true },
          },
        },
      },
    },
  });

  if (!room) notFound();

  const isParticipant = room.participants.some((p) => p.user.id === userId);
  if (!isParticipant) redirect("/dashboard/chat");

  // The server expects the "chat:{id}" format
  const chatServerRoomId = `chat:${room.id}`;

  const roomName = room.project?.title ?? "Chat";

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-slate-900/70 border-b border-slate-800/80">
        <Link
          href="/dashboard/chat"
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>All Messages</span>
        </Link>

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span className="hidden sm:inline">End-to-end encrypted channel</span>
          <span className="sm:hidden">Secure</span>
        </div>
      </div>

      {/* Participants row */}
      <div className="shrink-0 flex items-center gap-4 px-4 py-2.5 bg-slate-900/40 border-b border-slate-800/60">
        <div className="flex items-center gap-3 flex-wrap">
          {room.participants.map((p, i) => (
            <div key={p.user.id} className="flex items-center gap-3">
              {i > 0 && (
                <span className="text-slate-700 text-xs">↔</span>
              )}
              <ParticipantChip
                user={p.user}
                isCurrentUser={p.user.id === userId}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ChatBox */}
      <div className="flex-1 min-h-0">
        <ChatBox
          roomId={chatServerRoomId}
          chatType="PROJECT"
          roomName={roomName}
          currentUser={{
            id: userId,
            name: session.user.name ?? "Unknown",
            image: session.user.image ?? null,
          }}
          showLegalDisclaimer
        />
      </div>
    </div>
  );
}

// ─── Participant chip ────────────────────────────────────────

function ParticipantChip({
  user,
  isCurrentUser,
}: {
  user: { id: string; name: string; image: string | null };
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
          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-slate-700 text-white text-[9px] font-bold">
            {user.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <p className="text-xs font-medium text-slate-300 leading-none">
        {user.name}
        {isCurrentUser && (
          <span className="ml-1 text-[10px] text-indigo-400">(you)</span>
        )}
      </p>
    </div>
  );
}