import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import ChatBox from "@/components/chat/ChatBox";

interface PageProps {
  params: Promise<{ locale: string; roomId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { roomId, locale } = await params;
  const t = await getTranslations({ locale, namespace: "chat.room" });
  const room = await db.chatRoom.findUnique({
    where: { id: roomId },
    select: { project: { select: { title: true } } },
  });
  return {
    title: room?.project?.title
      ? `${room.project.title} — ${t("chatDefault")}`
      : `${t("chatDefault")} — EduSpark`,
    robots: { index: false, follow: false },
  };
}

export default async function ChatRoomPage({ params }: PageProps) {
  const { roomId } = await params;
  const session = await getServerSession(authOptions);
  const locale = await getLocale();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/login`);
  }

  const t = await getTranslations("chat.room");
  const userId = session.user.id;

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
            select: { id: true, name: true, role: true },
          },
        },
      },
    },
  });

  if (!room) notFound();

  const isParticipant = room.participants.some((p) => p.user.id === userId);
  if (!isParticipant) {
    redirect(`/${locale}/dashboard/chat`);
  }

  const chatServerRoomId = `chat:${room.id}`;
  const roomName = room.project?.title ?? t("chatDefault");

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-card/70 border-b border-border/80">
        <Link
          href="/dashboard/chat"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform rtl:rotate-180 rtl:group-hover:translate-x-0.5" />
          <span>{t("allMessages")}</span>
        </Link>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span className="hidden sm:inline">{t("endToEndEncrypted")}</span>
          <span className="sm:hidden">{t("secure")}</span>
        </div>
      </div>

      {/* Participants row */}
      <div className="shrink-0 flex items-center gap-4 px-4 py-2.5 bg-card/40 border-b border-border/60">
        <div className="flex items-center gap-3 flex-wrap">
          {room.participants.map((p, i) => (
            <div key={p.user.id} className="flex items-center gap-3">
              {i > 0 && (
                <span className="text-muted-foreground text-xs">↔</span>
              )}
              <ParticipantChip
                user={p.user}
                isCurrentUser={p.user.id === userId}
                youLabel={t("you")}
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
            image: null,
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
  youLabel,
}: {
  user: { id: string; name: string };
  isCurrentUser: boolean;
  youLabel: string;
}) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue =
    user.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  return (
    <div className="flex items-center gap-2">
      <div className="relative shrink-0 w-6 h-6">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
          style={{ background: `hsl(${hue}, 55%, 42%)` }}
        >
          {initials}
        </div>
      </div>
      <p className="text-xs font-medium text-foreground leading-none">
        {user.name}
        {isCurrentUser && (
          <span className="ml-1 text-[10px] text-primary">{youLabel}</span>
        )}
      </p>
    </div>
  );
}