import Image from "next/image";
import Link from "next/link";
import {
  MessageSquare,
  ChevronRight,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatRoomType, ProjectStatus, Role } from "@prisma/client";

interface ParticipantUser {
  id: string;
  name: string;
  image: string | null;
  role: Role;
}

interface LastMessage {
  content: string;
  createdAt: string;
  isSystem: boolean;
  senderName: string;
  senderId: string;
}

interface RoomData {
  id: string;
  type: ChatRoomType;
  updatedAt: string;
  projectTitle: string | null;
  projectId: string | null;
  projectStatus: ProjectStatus | null;
  courseTitle: string | null;
  courseId: string | null;
  participants: ParticipantUser[];
  lastMessage: LastMessage | null;
}

interface ChatRoomListProps {
  rooms: RoomData[];
  currentUserId: string;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function Avatar({
  name,
  image,
  size = 44,
  badge,
}: {
  name: string;
  image: string | null;
  size?: number;
  badge?: boolean;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {image ? (
        <Image
          src={image}
          alt={name}
          width={size}
          height={size}
          className="rounded-full object-cover ring-2 ring-slate-800"
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-white font-bold ring-2 ring-slate-800"
          style={{
            width: size,
            height: size,
            fontSize: size * 0.36,
            background: `hsl(${hue}, 55%, 42%)`,
          }}
        >
          {initials}
        </div>
      )}
      {badge && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
      )}
    </div>
  );
}

const TYPE_BADGE: Record<
  ChatRoomType,
  { label: string; className: string; icon: typeof MessageSquare }
> = {
  PROJECT: {
    label: "Project",
    className:
      "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    icon: Sparkles,
  },
  COURSE: {
    label: "Course",
    className:
      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    icon: BookOpen,
  },
  DIRECT: {
    label: "Direct",
    className:
      "bg-violet-500/10 text-violet-400 border-violet-500/20",
    icon: MessageSquare,
  },
  SUPPORT: {
    label: "Support",
    className:
      "bg-amber-500/10 text-amber-400 border-amber-500/20",
    icon: MessageSquare,
  },
};

function RoomRow({
  room,
  currentUserId,
}: {
  room: RoomData;
  currentUserId: string;
}) {
  const displayName =
    room.participants.length === 0
      ? "No other participants"
      : room.participants.length === 1
      ? room.participants[0]!.name
      : `${room.participants[0]!.name} + ${room.participants.length - 1}`;

  const roomTitle =
    room.projectTitle ?? room.courseTitle ?? displayName;

  const lastMessage = room.lastMessage;
  const isOwnLast = lastMessage?.senderId === currentUserId;
  const preview = lastMessage
    ? lastMessage.isSystem
      ? lastMessage.content
      : `${isOwnLast ? "You: " : `${lastMessage.senderName.split(" ")[0]}: `}${lastMessage.content}`
    : "No messages yet";

  const truncated =
    preview.length > 60 ? `${preview.slice(0, 60)}…` : preview;

  const badgeConfig = TYPE_BADGE[room.type];
  const BadgeIcon = badgeConfig.icon;

  return (
    <Link
      href={`/dashboard/chat/${room.id}`}
      className={cn(
        "group flex items-center gap-4 p-4 rounded-2xl",
        "bg-slate-900 border border-slate-800",
        "hover:border-indigo-500/40 hover:bg-slate-900/80",
        "transition-all duration-200"
      )}
    >
      <div className="relative shrink-0">
        {room.participants.length >= 1 ? (
          <Avatar
            name={room.participants[0]!.name}
            image={room.participants[0]!.image}
            size={44}
            badge
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-slate-800 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-slate-600" />
          </div>
        )}

        {room.participants.length > 1 && (
          <div className="absolute -bottom-1 -right-1 ring-2 ring-slate-900 rounded-full">
            <Avatar
              name={room.participants[1]!.name}
              image={room.participants[1]!.image}
              size={22}
            />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-bold text-white truncate">{roomTitle}</p>
          <span
            className={cn(
              "shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border",
              badgeConfig.className
            )}
          >
            <BadgeIcon className="w-2.5 h-2.5" />
            {badgeConfig.label}
          </span>
        </div>

        <p
          className={cn(
            "text-xs truncate",
            lastMessage?.isSystem ? "text-slate-600 italic" : "text-slate-500"
          )}
        >
          {truncated}
        </p>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-1">
        <span className="text-[10px] text-slate-600 tabular-nums">
          {formatRelative(room.updatedAt)}
        </span>
        <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  );
}

export function ChatRoomList({ rooms, currentUserId }: ChatRoomListProps) {
  return (
    <div className="space-y-2">
      {rooms.map((room) => (
        <RoomRow key={room.id} room={room} currentUserId={currentUserId} />
      ))}
    </div>
  );
}