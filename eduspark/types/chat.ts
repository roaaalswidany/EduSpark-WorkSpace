// ─── Enums ────────────────────────────────────────────────────────────────────

export type ChatType = "PROJECT" | "EDUCATIONAL" | "SUPPORT";

export type MessageStatus =
  | "sending"    // Optimistic: just added by client
  | "sent"       // Server acknowledged (ack callback returned ok)
  | "delivered"  // Server persisted to DB (message_saved event)
  | "seen"       // Recipient viewed the message (local tracking)
  | "failed";    // Delivery failed — client should offer retry

export type SocketStatus =
  | "idle"
  | "fetching_token"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "auth_failed"
  | "error";

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  tempId: string;
  chatRoomId: string;
  content: string;
  isSystem: boolean;
  sender: {
    id: string;
    name: string;
    image: string | null;
  };
  replyToId: string | null;
  createdAt: string; // ISO 8601
  status: MessageStatus;
}

export interface OnlineUser {
  userId: string;
  name: string;
  image: string | null;
  role: "STUDENT" | "CREATOR" | "ADMIN";
  connectedAt: string;
}

export interface TypingUser {
  userId: string;
  name: string;
}

// ─── Socket Payloads (mirrors server types/index.ts) ─────────────────────────

export interface JoinRoomPayload {
  roomId: string;
}

export interface SendMessagePayload {
  roomId: string;
  content: string;
  tempId: string;
  replyToId?: string;
}

export interface BroadcastMessage {
  id: string;
  tempId: string;
  chatRoomId: string;
  content: string;
  isSystem: boolean;
  sender: { id: string; name: string; image: string | null };
  replyToId: string | null;
  createdAt: string;
}

export interface MessageAckPayload {
  messageId: string;
  tempId: string;
  createdAt: string;
}

export interface RoomJoinedPayload {
  roomId: string;
  users: OnlineUser[];
  history: BroadcastMessage[];
  totalMessages: number;
}

export interface TypingIndicatorPayload {
  roomId: string;
  userId: string;
  name: string;
  isTyping: boolean;
}

export interface PresenceOnlinePayload {
  userId: string;
  name: string;
  image: string | null;
  role: string;
  connectedAt: string;
}

export interface PresenceOfflinePayload {
  userId: string;
  name: string;
  disconnectedAt: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export type AckResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorPayload };

// ─── Message grouping (rendering abstraction) ─────────────────────────────────

export type DateDivider = {
  kind: "date";
  isoDate: string;
};

export type SystemEntry = {
  kind: "system";
  message: ChatMessage;
};

export type MessageGroup = {
  kind: "group";
  senderId: string;
  senderName: string;
  senderImage: string | null;
  isOwn: boolean;
  messages: ChatMessage[];
  firstAt: string;
};

export type RenderEntry = DateDivider | SystemEntry | MessageGroup;