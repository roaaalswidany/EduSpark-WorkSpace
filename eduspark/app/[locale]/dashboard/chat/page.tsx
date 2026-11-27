import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { MessageSquare, Search } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { ChatRoomList } from "./_components/chat-room-list-item";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "chat.page" });
  return { title: `${t("title")} — EduSpark` };
}

export default async function ChatPage() {
  const session = await getServerSession(authOptions);
  const locale = await getLocale();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/login`);
  }

  const t = await getTranslations("chat.page");
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
            select: { id: true, name: true, role: true },
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
        <div className="flex items-center gap-2 text-xs font-bold text-primary mb-2">
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">{t("inbox")}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground tracking-tight">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {roomsData.length === 0
            ? t("noConversations")
            : t("conversationsCount", { count: roomsData.length })}
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

async function EmptyState() {
  const t = await getTranslations("chat.page");
  return (
    <div className="rounded-2xl bg-card border border-border p-12 sm:p-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
        <MessageSquare className="w-7 h-7 text-primary" />
      </div>
      <h2 className="text-lg font-bold text-foreground mb-1.5">
        {t("emptyTitle")}
      </h2>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6 leading-relaxed">
        {t("emptyDesc")}
      </p>
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
      >
        <Search className="w-4 h-4" />
        {t("browseServices")}
      </Link>
    </div>
  );
}