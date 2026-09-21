"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";
import Image from "next/image";
import {
  Send,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Loader2,
  Briefcase,
  GraduationCap,
  LifeBuoy,
  ExternalLink,
  ChevronDown,
  Wifi,
  WifiOff,
  RotateCcw,
  FileText,
  Scale,
  Users,
} from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { cn } from "@/lib/utils";
import type {
  ChatType,
  ChatMessage,
  OnlineUser,
  TypingUser,
  BroadcastMessage,
  MessageAckPayload,
  TypingIndicatorPayload,
  PresenceOnlinePayload,
  PresenceOfflinePayload,
  RenderEntry,
  MessageGroup,
  AckResponse,
  RoomJoinedPayload,
  RoomUsersPayload,
} from "@/types/chat";

// ─── Environment ──────────────────────────────────────────────────────────────

const TYPING_DEBOUNCE_MS = 2_000;
const TYPING_AUTO_CLEAR_MS = 5_000;
const AUTO_SCROLL_THRESHOLD_PX = 120;
const GROUP_WINDOW_MS = 5 * 60 * 1_000; // group messages within 5 minutes
const MAX_INPUT_CHARS = 4_000;
const HISTORY_LIMIT = 50;

// ─── Chat type config ─────────────────────────────────────────────────────────

const CHAT_TYPE_CONFIG = {
  PROJECT: {
    label: "Project Chat",
    Icon: Briefcase,
    accent: "text-indigo-400",
    badge: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
    bubbleOwn: "bg-indigo-600 text-white",
    bubbleOther: "bg-slate-800 text-slate-100",
    legal: true,
  },
  EDUCATIONAL: {
    label: "Course Room",
    Icon: GraduationCap,
    accent: "text-amber-400",
    badge: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    bubbleOwn: "bg-amber-600 text-white",
    bubbleOther: "bg-slate-800 text-slate-100",
    legal: false,
  },
  SUPPORT: {
    label: "Support",
    Icon: LifeBuoy,
    accent: "text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    bubbleOwn: "bg-emerald-700 text-white",
    bubbleOther: "bg-slate-800 text-slate-100",
    legal: false,
  },
} as const satisfies Record<ChatType, {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: string;
  badge: string;
  bubbleOwn: string;
  bubbleOther: string;
  legal: boolean;
}>;

// ─── Utility helpers ──────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateDivider(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^[\]`]+)/g;

interface ContentPart {
  kind: "text" | "link";
  value: string;
}

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(URL_REGEX)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      parts.push({ kind: "text", value: content.slice(lastIndex, idx) });
    }
    parts.push({ kind: "link", value: match[0] });
    lastIndex = idx + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ kind: "text", value: content.slice(lastIndex) });
  }

  return parts.length === 0 ? [{ kind: "text", value: content }] : parts;
}

function groupMessages(messages: ChatMessage[], currentUserId: string): RenderEntry[] {
  const result: RenderEntry[] = [];
  let lastDate: string | null = null;
  let currentGroup: MessageGroup | null = null;

  for (const msg of messages) {
    const dateStr = new Date(msg.createdAt).toDateString();

    if (dateStr !== lastDate) {
      lastDate = dateStr;
      result.push({ kind: "date", isoDate: msg.createdAt });
      currentGroup = null;
    }

    if (msg.isSystem) {
      currentGroup = null;
      result.push({ kind: "system", message: msg });
      continue;
    }

    const isOwn = msg.sender.id === currentUserId;
    const timeSinceGroup = currentGroup
      ? new Date(msg.createdAt).getTime() - new Date(currentGroup.firstAt).getTime()
      : Infinity;

    const sameGroup =
      currentGroup !== null &&
      currentGroup.senderId === msg.sender.id &&
      timeSinceGroup < GROUP_WINDOW_MS;

    if (sameGroup && currentGroup !== null) {
      currentGroup.messages.push(msg);
    } else {
      currentGroup = {
        kind: "group",
        senderId: msg.sender.id,
        senderName: msg.sender.name,
        senderImage: msg.sender.image,
        isOwn,
        messages: [msg],
        firstAt: msg.createdAt,
      };
      result.push(currentGroup);
    }
  }

  return result;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UserAvatar({
  name,
  image,
  size = 32,
  isOnline = false,
}: {
  name: string;
  image: string | null;
  size?: number;
  isOnline?: boolean;
}) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const hue = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {image ? (
        <Image
          src={image}
          alt={name}
          width={size}
          height={size}
          className="rounded-full object-cover"
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center font-bold text-white"
          style={{
            width: size,
            height: size,
            fontSize: size * 0.38,
            background: `hsl(${hue}, 50%, 40%)`,
          }}
        >
          {initials}
        </div>
      )}
      {isOnline && (
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950" />
      )}
    </div>
  );
}

function ReadReceipt({ status }: { status: ChatMessage["status"] }) {
  switch (status) {
    case "sending":
      return <Clock className="w-3 h-3 text-white/40 shrink-0" />;
    case "sent":
      return <Check className="w-3 h-3 text-white/50 shrink-0" />;
    case "delivered":
      return <CheckCheck className="w-3 h-3 text-white/60 shrink-0" />;
    case "seen":
      return <CheckCheck className="w-3 h-3 text-sky-300 shrink-0" />;
    case "failed":
      return <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />;
  }
}

function LinkCard({ url }: { url: string }) {
  let hostname = url;
  try {
    hostname = new URL(url).hostname.replace("www.", "");
  } catch {
    /* malformed URL — show raw */
  }

  const isFile = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|tar|gz|png|jpe?g|gif|svg|mp4|mov)(\?|$)/i.test(url);

  return (
    
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex items-center gap-2.5 mt-2 px-3 py-2.5 rounded-xl",
        "bg-white/8 hover:bg-white/12 border border-white/10 hover:border-white/20",
        "transition-all duration-150 max-w-xs"
      )}
    >
      <div className="shrink-0 w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
        {isFile ? (
          <FileText className="w-3.5 h-3.5 text-white/70" />
        ) : (
          <ExternalLink className="w-3.5 h-3.5 text-white/70" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/80 truncate group-hover:text-white transition-colors">
          {url.length > 45 ? url.slice(0, 42) + "…" : url}
        </p>
        <p className="text-[10px] text-white/40 mt-0.5">{hostname}</p>
      </div>
    </a>
  );
}

const MessageContent = memo(function MessageContent({
  content,
  isOwn,
}: {
  content: string;
  isOwn: boolean;
}) {
  const parts = useMemo(() => parseContent(content), [content]);
  const links = parts.filter((p) => p.kind === "link");

  return (
    <div className="space-y-0.5">
      <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
        {parts.map((part, i) =>
          part.kind === "link" ? (
            
              key={i}
              href={part.value}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "underline underline-offset-2 hover:opacity-80 transition-opacity",
                isOwn ? "decoration-white/50" : "decoration-indigo-400 text-indigo-300"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {part.value}
            </a>
          ) : (
            <span key={i}>{part.value}</span>
          )
        )}
      </p>

      {/* Render file/link cards for detected URLs */}
      {links.length > 0 && (
        <div className="space-y-1.5">
          {links.map((link, i) => (
            <LinkCard key={i} url={link.value} />
          ))}
        </div>
      )}
    </div>
  );
});

const MessageBubble = memo(function MessageBubble({
  message,
  isFirst,
  isLast,
  isOwn,
  chatType,
  onRetry,
}: {
  message: ChatMessage;
  isFirst: boolean;
  isLast: boolean;
  isOwn: boolean;
  chatType: ChatType;
  onRetry: (msg: ChatMessage) => void;
}) {
  const config = CHAT_TYPE_CONFIG[chatType];

  const bubbleClass = isOwn ? config.bubbleOwn : config.bubbleOther;

  const ownRadius = cn(
    "rounded-2xl",
    isFirst && isLast && "rounded-2xl",
    isFirst && !isLast && "rounded-2xl rounded-br-md",
    !isFirst && isLast && "rounded-2xl rounded-tr-md rounded-br-md",
    !isFirst && !isLast && "rounded-2xl rounded-r-md"
  );

  const otherRadius = cn(
    "rounded-2xl",
    isFirst && isLast && "rounded-2xl",
    isFirst && !isLast && "rounded-2xl rounded-bl-md",
    !isFirst && isLast && "rounded-2xl rounded-tl-md rounded-bl-md",
    !isFirst && !isLast && "rounded-2xl rounded-l-md"
  );

  return (
    <div
      data-message-id={message.id}
      className={cn("flex items-end gap-1.5", isOwn && "flex-row-reverse")}
    >
      <div
        className={cn(
          "px-4 py-2.5 max-w-[72%] sm:max-w-[60%] shadow-sm",
          bubbleClass,
          isOwn ? ownRadius : otherRadius
        )}
      >
        <MessageContent content={message.content} isOwn={isOwn} />

        {/* Timestamp + status */}
        <div
          className={cn(
            "flex items-center gap-1 mt-1",
            isOwn ? "justify-end" : "justify-start"
          )}
        >
          <span
            className={cn(
              "text-[10px]",
              isOwn ? "text-white/40" : "text-slate-500"
            )}
          >
            {formatTime(message.createdAt)}
          </span>

          {isOwn && <ReadReceipt status={message.status} />}

          {isOwn && message.status === "failed" && (
            <button
              onClick={() => onRetry(message)}
              className="text-[10px] text-red-400 hover:text-red-300 underline ml-1"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

function TypingIndicator({ users }: { users: TypingUser[] }) {
  if (users.length === 0) return null;

  const label =
    users.length === 1
      ? `${users[0]!.name} is typing`
      : users.length === 2
      ? `${users[0]!.name} and ${users[1]!.name} are typing`
      : `${users[0]!.name} and ${users.length - 1} others are typing`;

  return (
    <div className="flex items-center gap-2.5 px-4 py-2">
      <div className="flex items-center gap-1 px-3 py-2 rounded-2xl rounded-bl-md bg-slate-800">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
            style={{ animationDelay: `${i * 150}ms`, animationDuration: "900ms" }}
          />
        ))}
      </div>
      <span className="text-[11px] text-slate-500 italic">{label}…</span>
    </div>
  );
}

function ConnectionBanner({
  status,
  reconnectAttempt,
  onRetry,
}: {
  status: string;
  reconnectAttempt: number;
  onRetry: () => void;
}) {
  if (status === "connected") return null;

  const isReconnecting = status === "reconnecting";
  const isError = status === "error" || status === "auth_failed";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5 text-xs border-b",
        isReconnecting && "bg-amber-500/10 border-amber-500/20 text-amber-300",
        isError && "bg-red-500/10 border-red-500/20 text-red-300",
        !isReconnecting && !isError && "bg-slate-800/60 border-slate-700 text-slate-400"
      )}
    >
      <div className="flex items-center gap-2">
        {isReconnecting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isError ? (
          <WifiOff className="w-3.5 h-3.5" />
        ) : (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        )}
        <span>
          {isReconnecting
            ? `Reconnecting… (attempt ${reconnectAttempt})`
            : isError
            ? "Connection lost."
            : "Connecting to chat server…"}
        </span>
      </div>

      {isError && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1 text-red-300 hover:text-red-200 font-semibold transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Retry
        </button>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ChatBoxProps {
  roomId: string;
  chatType: ChatType;
  roomName: string;
  currentUser: {
    id: string;
    name: string;
    image: string | null;
  };
  className?: string;
  showLegalDisclaimer?: boolean;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChatBox({
  roomId,
  chatType,
  roomName,
  currentUser,
  className,
  showLegalDisclaimer = false,
}: ChatBoxProps) {
  const { socket, status, isConnected, isReconnecting, error, reconnectAttempt, forceReconnect } =
    useSocket();

  // ── Core state ─────────────────────────────────────────────────────────────

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [isSendingTyping, setIsSendingTyping] = useState(false);
  const [showOnlineList, setShowOnlineList] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const typingClearTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Stable refs to avoid stale closures in socket callbacks
  const currentUserRef = useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  const roomIdRef = useRef(roomId);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  const config = CHAT_TYPE_CONFIG[chatType];

  // ── Scroll helpers ─────────────────────────────────────────────────────────

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setHasNewMessages(false);
    isAtBottomRef.current = true;
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distFromBottom < AUTO_SCROLL_THRESHOLD_PX;
    isAtBottomRef.current = nearBottom;
    if (nearBottom) setHasNewMessages(false);
  }, []);

  // ── Message renderer (grouped + dates) ─────────────────────────────────────

  const renderEntries = useMemo(
    () => groupMessages(messages, currentUser.id),
    [messages, currentUser.id]
  );

  // ── Read receipt tracking (IntersectionObserver) ───────────────────────────

  useEffect(() => {
    const scrollEl = scrollAreaRef.current;
    if (!scrollEl || messages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const msgId = (entry.target as HTMLElement).dataset["messageId"];
          if (!msgId) return;
          // Mark others' messages as "seen" locally when they scroll into view
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId && m.sender.id !== currentUserRef.current.id && m.status !== "seen"
                ? { ...m, status: "seen" as const }
                : m
            )
          );
        });
      },
      { root: scrollEl, threshold: 0.8 }
    );

    const elements = scrollEl.querySelectorAll("[data-message-id]");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [renderEntries]);

  // ── Auto-scroll on new messages ────────────────────────────────────────────

  useEffect(() => {
    if (messages.length === 0) return;
    if (isAtBottomRef.current) {
      scrollToBottom("smooth");
    } else {
      setHasNewMessages(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // ── Join room when connected ───────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !isConnected) return;

    let active = true;

    const join = () => {
      setIsJoining(true);
      setJoinError(null);

      socket.emit(
        "join_room",
        { roomId },
        (response: AckResponse<RoomJoinedPayload>) => {
          if (!active) return;
          setIsJoining(false);

          if (response.ok) {
            const history: ChatMessage[] = response.data.history
              .slice(-HISTORY_LIMIT)
              .map((m: BroadcastMessage) => ({
                ...m,
                status: "delivered" as const,
                chatRoomId: roomId,
              }));

            setMessages(history);
            setOnlineUsers(response.data.users);
            setIsJoined(true);
            // Scroll to bottom immediately after history loads
            requestAnimationFrame(() => scrollToBottom("instant"));
          } else {
            setJoinError(response.error.message);
          }
        }
      );
    };

    // Handle connection state recovery
    socket.on("reconnect_ack", ({ recoveredRooms }: { recoveredRooms: string[] }) => {
      if (!active) return;
      if (recoveredRooms.includes(roomId)) {
        setIsJoined(true);
        // Refresh user list after recovery
        socket.emit(
          "get_room_users",
          { roomId },
          (res: AckResponse<RoomUsersPayload>) => {
            if (res.ok) setOnlineUsers(res.data.users);
          }
        );
      } else {
        // State not recovered → re-join
        join();
      }
    });

    join();

    return () => {
      active = false;
      socket.off("reconnect_ack");
      socket.emit("leave_room", { roomId });
      setIsJoined(false);
    };
  }, [socket, isConnected, roomId, scrollToBottom]);

  // ── Socket event listeners ─────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !isJoined) return;

    // ── message_new ────────────────────────────────────────────────────────

    const onMessageNew = (msg: BroadcastMessage) => {
      setMessages((prev) => {
        // If it's our own message and we have an optimistic copy, update it
        if (msg.sender.id === currentUserRef.current.id) {
          const optimisticIdx = prev.findIndex((m) => m.tempId === msg.tempId);
          if (optimisticIdx !== -1) {
            return prev.map((m, i) =>
              i === optimisticIdx
                ? { ...m, id: msg.id, status: "sent" as const, createdAt: msg.createdAt }
                : m
            );
          }
        }
        // Deduplicate
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [
          ...prev,
          {
            ...msg,
            status: "delivered" as const,
            chatRoomId: roomIdRef.current,
          },
        ];
      });
    };

    // ── message_saved ──────────────────────────────────────────────────────

    const onMessageSaved = ({ tempId, messageId, createdAt }: MessageAckPayload) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.tempId === tempId
            ? { ...m, id: messageId, status: "delivered" as const, createdAt }
            : m
        )
      );
    };

    // ── message_error ──────────────────────────────────────────────────────

    const onMessageError = ({ tempId }: { tempId: string; error: { code: string; message: string } }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.tempId === tempId ? { ...m, status: "failed" as const } : m
        )
      );
    };

    // ── typing_indicator ───────────────────────────────────────────────────

    const onTypingIndicator = ({ userId, name, isTyping }: TypingIndicatorPayload) => {
      if (userId === currentUserRef.current.id) return;

      const existingTimer = typingClearTimers.current.get(userId);
      if (existingTimer) clearTimeout(existingTimer);

      if (isTyping) {
        setTypingUsers((prev) => {
          if (prev.some((u) => u.userId === userId)) return prev;
          return [...prev, { userId, name }];
        });

        const timer = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
          typingClearTimers.current.delete(userId);
        }, TYPING_AUTO_CLEAR_MS);

        typingClearTimers.current.set(userId, timer);
      } else {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
        typingClearTimers.current.delete(userId);
      }
    };

    // ── user_joined / user_left ────────────────────────────────────────────

    const onUserJoined = ({ user }: { roomId: string; user: OnlineUser }) => {
      setOnlineUsers((prev) => {
        if (prev.some((u) => u.userId === user.userId)) return prev;
        return [...prev, user];
      });
    };

    const onUserLeft = ({ userId }: { roomId: string; userId: string; name: string }) => {
      setOnlineUsers((prev) => prev.filter((u) => u.userId !== userId));
      setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
    };

    // ── presence_online / presence_offline ─────────────────────────────────

    const onPresenceOnline = (data: PresenceOnlinePayload) => {
      setOnlineUsers((prev) => {
        if (prev.some((u) => u.userId === data.userId)) return prev;
        return [
          ...prev,
          {
            userId: data.userId,
            name: data.name,
            image: data.image,
            role: data.role as OnlineUser["role"],
            connectedAt: data.connectedAt,
          },
        ];
      });
    };

    const onPresenceOffline = ({ userId }: PresenceOfflinePayload) => {
      setOnlineUsers((prev) => prev.filter((u) => u.userId !== userId));
    };

    socket.on("message_new", onMessageNew);
    socket.on("message_saved", onMessageSaved);
    socket.on("message_error", onMessageError);
    socket.on("typing_indicator", onTypingIndicator);
    socket.on("user_joined", onUserJoined);
    socket.on("user_left", onUserLeft);
    socket.on("presence_online", onPresenceOnline);
    socket.on("presence_offline", onPresenceOffline);

    return () => {
      socket.off("message_new", onMessageNew);
      socket.off("message_saved", onMessageSaved);
      socket.off("message_error", onMessageError);
      socket.off("typing_indicator", onTypingIndicator);
      socket.off("user_joined", onUserJoined);
      socket.off("user_left", onUserLeft);
      socket.off("presence_online", onPresenceOnline);
      socket.off("presence_offline", onPresenceOffline);

      // Clear all typing timers on cleanup
      for (const timer of typingClearTimers.current.values()) {
        clearTimeout(timer);
      }
      typingClearTimers.current.clear();
    };
  }, [socket, isJoined]);

  // ── Send message ───────────────────────────────────────────────────────────

  const sendMessage = useCallback(() => {
    const content = inputValue.trim();
    if (!content || !socket || !isConnected || !isJoined) return;
    if (content.length > MAX_INPUT_CHARS) return;

    const tempId = crypto.randomUUID();

    // Optimistic message
    const optimistic: ChatMessage = {
      id: tempId,
      tempId,
      chatRoomId: roomId,
      content,
      isSystem: false,
      sender: {
        id: currentUser.id,
        name: currentUser.name,
        image: currentUser.image,
      },
      replyToId: null,
      createdAt: new Date().toISOString(),
      status: "sending",
    };

    setMessages((prev) => [...prev, optimistic]);
    setInputValue("");
    scrollToBottom("smooth");

    // Stop typing indicator
    if (isSendingTyping) {
      socket.emit("typing_stop", { roomId });
      setIsSendingTyping(false);
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    // Emit to server with ack
    socket.emit(
      "send_message",
      { roomId, content, tempId },
      (response: AckResponse<{ messageId: string; tempId: string; createdAt: string }>) => {
        if (response.ok) {
          setMessages((prev) =>
            prev.map((m) =>
              m.tempId === tempId
                ? {
                    ...m,
                    id: response.data.messageId,
                    status: "sent" as const,
                    createdAt: response.data.createdAt,
                  }
                : m
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.tempId === tempId ? { ...m, status: "failed" as const } : m
            )
          );
        }
      }
    );
  }, [
    inputValue,
    socket,
    isConnected,
    isJoined,
    roomId,
    currentUser,
    isSendingTyping,
    scrollToBottom,
  ]);

  // ── Retry failed message ───────────────────────────────────────────────────

  const retryMessage = useCallback(
    (msg: ChatMessage) => {
      if (!socket || !isConnected) return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, status: "sending" as const } : m
        )
      );

      socket.emit(
        "send_message",
        { roomId, content: msg.content, tempId: msg.tempId },
        (response: AckResponse<{ messageId: string; tempId: string; createdAt: string }>) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.id
                ? {
                    ...m,
                    status: response.ok ? ("sent" as const) : ("failed" as const),
                    id: response.ok ? response.data.messageId : m.id,
                  }
                : m
            )
          );
        }
      );
    },
    [socket, isConnected, roomId]
  );

  // ── Typing events ──────────────────────────────────────────────────────────

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);

      if (!socket || !isConnected || !isJoined) return;

      if (!isSendingTyping) {
        setIsSendingTyping(true);
        socket.emit("typing_start", { roomId });
      }

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socket.emit("typing_stop", { roomId });
        setIsSendingTyping(false);
      }, TYPING_DEBOUNCE_MS);
    },
    [socket, isConnected, isJoined, isSendingTyping, roomId]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  // ── Derived state ──────────────────────────────────────────────────────────

  const onlineCount = onlineUsers.length;
  const isOwnUserOnline = onlineUsers.some((u) => u.userId === currentUser.id);
  const otherOnlineUsers = onlineUsers.filter((u) => u.userId !== currentUser.id);

  const canSend =
    isConnected && isJoined && inputValue.trim().length > 0 && inputValue.length <= MAX_INPUT_CHARS;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden",
        className
      )}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="shrink-0 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3 px-4 h-14">
          {/* Chat type badge */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold shrink-0",
              config.badge
            )}
          >
            <config.Icon className="w-3.5 h-3.5" />
            <span>{config.label}</span>
          </div>

          {/* Room name */}
          <h1 className="flex-1 min-w-0 text-sm font-semibold text-slate-200 truncate">
            {roomName}
          </h1>

          {/* Connection status dot */}
          <div className="flex items-center gap-2 shrink-0">
            {isReconnecting ? (
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            ) : isConnected ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-slate-600" />
            )}
          </div>

          {/* Online users button */}
          <button
            onClick={() => setShowOnlineList((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg",
              "bg-slate-800 hover:bg-slate-700 border border-slate-700",
              "text-xs text-slate-400 hover:text-slate-200 transition-all"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="font-semibold">{onlineCount}</span>
            <span className="hidden sm:inline text-slate-500">online</span>
          </button>
        </div>

        {/* Online users popover */}
        {showOnlineList && (
          <div className="border-t border-slate-800 px-4 py-3 bg-slate-900/80">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
              Online now
            </p>
            <div className="flex flex-wrap gap-2">
              {onlineUsers.map((user) => (
                <div key={user.userId} className="flex items-center gap-1.5">
                  <UserAvatar
                    name={user.name}
                    image={user.image}
                    size={22}
                    isOnline
                  />
                  <span className="text-xs text-slate-300">{user.name}</span>
                  {user.userId === currentUser.id && (
                    <span className="text-[10px] text-indigo-400">(you)</span>
                  )}
                </div>
              ))}
              {onlineUsers.length === 0 && (
                <span className="text-xs text-slate-600 italic">No users online</span>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── Connection status banner ─────────────────────────────────────────── */}
      <ConnectionBanner
        status={status}
        reconnectAttempt={reconnectAttempt}
        onRetry={forceReconnect}
      />

      {/* ── Legal disclaimer ─────────────────────────────────────────────────── */}
      {showLegalDisclaimer && config.legal && (
        <div className="shrink-0 flex items-start gap-2.5 px-4 py-3 bg-amber-500/5 border-b border-amber-500/15">
          <Scale className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-300/80 leading-relaxed">
            <span className="font-semibold text-amber-300">Legal Notice: </span>
            All messages in this project channel are permanently recorded and
            form part of the legally binding project record. By sending a
            message, you consent to its retention and potential use in dispute
            resolution.
          </p>
        </div>
      )}

      {/* ── Error state ──────────────────────────────────────────────────────── */}
      {joinError && (
        <div className="shrink-0 flex items-center gap-2.5 px-4 py-3 bg-red-500/8 border-b border-red-500/15">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300 flex-1">{joinError}</p>
          <button
            onClick={() => {
              setJoinError(null);
              setIsJoined(false);
            }}
            className="text-xs text-red-400 hover:text-red-300 font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Message list ─────────────────────────────────────────────────────── */}
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-1 scroll-smooth"
      >
        {/* Initial loading state */}
        {isJoining && (
          <div className="flex justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
              <p className="text-sm text-slate-600">Loading conversation…</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isJoining && isJoined && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div
              className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center mb-4",
                "bg-slate-800 border border-slate-700"
              )}
            >
              <config.Icon className={cn("w-7 h-7", config.accent)} />
            </div>
            <h3 className="text-sm font-semibold text-slate-400 mb-1">
              No messages yet
            </h3>
            <p className="text-xs text-slate-600 max-w-xs">
              Be the first to send a message in this {config.label.toLowerCase()}.
            </p>
          </div>
        )}

        {/* Render entries */}
        {renderEntries.map((entry, entryIdx) => {
          if (entry.kind === "date") {
            return (
              <div
                key={`date-${entryIdx}`}
                className="flex items-center gap-3 py-4"
              >
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[11px] font-medium text-slate-500 px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
                  {formatDateDivider(entry.isoDate)}
                </span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>
            );
          }

          if (entry.kind === "system") {
            return (
              <div
                key={entry.message.id}
                className="flex items-center gap-3 py-1.5"
              >
                <div className="flex-1 h-px bg-slate-800/60" />
                <span className="text-[11px] text-slate-500 italic px-3 max-w-xs text-center">
                  {entry.message.content}
                </span>
                <div className="flex-1 h-px bg-slate-800/60" />
              </div>
            );
          }

          // Message group
          const group = entry;
          const isUserOnline = onlineUsers.some((u) => u.userId === group.senderId);

          return (
            <div
              key={`group-${group.senderId}-${group.firstAt}`}
              className={cn(
                "flex gap-2.5 mt-3 first:mt-0",
                group.isOwn && "flex-row-reverse"
              )}
            >
              {/* Avatar (only for others, on first message of group) */}
              {!group.isOwn && (
                <div className="shrink-0 self-end mb-1">
                  <UserAvatar
                    name={group.senderName}
                    image={group.senderImage}
                    size={32}
                    isOnline={isUserOnline}
                  />
                </div>
              )}

              <div
                className={cn(
                  "flex flex-col gap-0.5 min-w-0",
                  group.isOwn ? "items-end" : "items-start",
                  "max-w-[80%]"
                )}
              >
                {/* Sender name (others only, first bubble) */}
                {!group.isOwn && (
                  <div className="flex items-center gap-2 px-1 mb-0.5">
                    <span className="text-xs font-semibold text-slate-300">
                      {group.senderName}
                    </span>
                    {isUserOnline && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                  </div>
                )}

                {/* Message bubbles in this group */}
                {group.messages.map((msg, msgIdx) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isFirst={msgIdx === 0}
                    isLast={msgIdx === group.messages.length - 1}
                    isOwn={group.isOwn}
                    chatType={chatType}
                    onRetry={retryMessage}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        <TypingIndicator users={typingUsers} />

        {/* Scroll anchor */}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* ── New messages banner ──────────────────────────────────────────────── */}
      {hasNewMessages && (
        <div className="shrink-0 flex justify-center pb-2 pointer-events-none">
          <button
            onClick={() => scrollToBottom("smooth")}
            className={cn(
              "pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full",
              "bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold",
              "shadow-lg shadow-indigo-500/30 transition-all animate-bounce"
            )}
          >
            <ChevronDown className="w-3.5 h-3.5" />
            New messages
          </button>
        </div>
      )}

      {/* ── Input area ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-slate-800 bg-slate-900 px-4 py-3">
        <div className="flex items-end gap-3">
          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                !isConnected
                  ? "Connecting…"
                  : !isJoined
                  ? "Joining room…"
                  : `Message ${roomName}…`
              }
              disabled={!isConnected || !isJoined}
              rows={1}
              maxLength={MAX_INPUT_CHARS}
              className={cn(
                "w-full bg-slate-800 border border-slate-700 rounded-xl",
                "px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600",
                "resize-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                "transition-all duration-150 leading-relaxed",
                "min-h-12 max-h-40 overflow-y-auto"
              )}
              style={{
                height: "auto",
                minHeight: "48px",
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
              }}
            />

            {/* Character count warning */}
            {inputValue.length > MAX_INPUT_CHARS * 0.85 && (
              <span
                className={cn(
                  "absolute bottom-2 right-3 text-[10px] font-semibold",
                  inputValue.length >= MAX_INPUT_CHARS
                    ? "text-red-400"
                    : "text-amber-400"
                )}
              >
                {inputValue.length}/{MAX_INPUT_CHARS}
              </span>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={sendMessage}
            disabled={!canSend}
            className={cn(
              "shrink-0 flex items-center justify-center w-11 h-11 rounded-xl",
              "transition-all duration-150 active:scale-95",
              canSend
                ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                : "bg-slate-800 text-slate-600 cursor-not-allowed"
            )}
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Keyboard hint */}
        <p className="text-[10px] text-slate-700 mt-1.5 pl-1">
          <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-600 font-mono text-[9px]">
            Enter
          </kbd>{" "}
          to send ·{" "}
          <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-600 font-mono text-[9px]">
            Shift+Enter
          </kbd>{" "}
          for new line
        </p>
      </div>
    </div>
  );
}