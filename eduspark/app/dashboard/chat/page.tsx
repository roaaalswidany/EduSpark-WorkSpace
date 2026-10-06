import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { MessageSquare, Search } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { ChatRoomList } from "./_components/chat-room-list-item";

export const metadata = {
  title: "Messages — EduSpark",
};

export default async function ChatPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const userId = session.user.id;

  const rooms = await db.chatRoom.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      type: true,
      updatedAt: true,
      project: { select: { id: true, title: true, status: true } },
      course: { select: { id: true, title: true, slug: true } },
      participants: {
        select: {
          user: {
            select: { id: true, name: true, image: true, role: true },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          content: true,
          createdAt: true,
          isSystem: true,
          sender: { select: { id: true, name: true } },
        },
      },
    },
  });

  const roomsData = rooms.map((r) => {
    const otherParticipants = r.participants
      .map((p) => p.user)
      .filter((u) => u.id !== userId);

    const lastMsg = r.messages[0];

    return {
      id: r.id,
      type: r.type,
      updatedAt: r.updatedAt.toISOString(),
      projectTitle: r.project?.title ?? null,
      projectId: r.project?.id ?? null,
      projectStatus: r.project?.status ?? null,
      courseTitle: r.course?.title ?? null,
      courseId: r.course?.id ?? null,
      participants: otherParticipants,
      lastMessage: lastMsg
        ? {
            content: lastMsg.content,
            createdAt: lastMsg.createdAt.toISOString(),
            isSystem: lastMsg.isSystem,
            senderName: lastMsg.sender.name,
            senderId: lastMsg.sender.id,
          }
        : null,
    };
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-2">
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">Inbox</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
          Messages
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          {roomsData.length === 0
            ? "No conversations yet. Start a project to unlock chat."
            : `${roomsData.length} ${
                roomsData.length === 1 ? "conversation" : "conversations"
              }`}
        </p>
      </div>

      {roomsData.length === 0 ? (
        <EmptyState />
      ) : (
        <ChatRoomList rooms={roomsData} currentUserId={userId} />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-12 sm:p-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-5">
        <MessageSquare className="w-7 h-7 text-indigo-400" />
      </div>
      <h2 className="text-lg font-bold text-white mb-1.5">
        No conversations yet
      </h2>
      <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6 leading-relaxed">
        Chats unlock automatically when you order a service, enroll in a
        course, or a creator accepts your project.
      </p>
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
      >
        <Search className="w-4 h-4" />
        Browse Services
      </Link>
    </div>
  );
}