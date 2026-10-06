// ============================================================================
// Socket.io TypeScript Definitions
// ============================================================================

import type { Socket, Server } from "socket.io";
import type { Role } from "@prisma/client";

// ─── Authenticated User ──────────────────────────────────────────────────────
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  image: string | null;
}

// ─── Room Types ───────────────────────────────────────────────────────────────
export type RoomType =
  | "course-study-group"
  | "project-workspace"
  | "support-channel";

export interface ParsedRoomId {
  type: RoomType;
  targetId: string;
  fullRoomId: string;
}

// ─── Client → Server Events ───────────────────────────────────────────────────
export interface ClientToServerEvents {
  join_room: (
    payload: JoinRoomPayload,
    callback: (response: SocketResponse<JoinRoomSuccess>) => void
  ) => void;

  leave_room: (
    payload: LeaveRoomPayload,
    callback: (response: SocketResponse<null>) => void
  ) => void;

  send_message: (
    payload: SendMessagePayload,
    callback: (response: SocketResponse<MessageSentSuccess>) => void
  ) => void;

  typing_start: (payload: TypingPayload) => void;
  typing_stop: (payload: TypingPayload) => void;

  ping_room: (
    payload: { roomId: string },
    callback: (response: SocketResponse<RoomStatusSuccess>) => void
  ) => void;

  get_room_users: (
    payload: { roomId: string },
    callback: (response: SocketResponse<{ users: OnlineUserInfo[] }>) => void
  ) => void;
}

// ─── Server → Client Events ───────────────────────────────────────────────────
export interface ServerToClientEvents {
  message_new: (data: BroadcastMessage) => void;
  message_saved: (data: MessageSentSuccess) => void;
  message_error: (data: {
    tempId: string;
    error: { code: string; message: string };
  }) => void;

  typing_indicator: (data: TypingIndicatorPayload) => void;

  user_joined: (data: UserRoomEventPayload) => void;
  user_left: (data: UserRoomEventPayload) => void;

  presence_online: (data: PresencePayload) => void;
  presence_offline: (data: PresencePayload) => void;

  reconnect_ack: (data: { recoveredRooms: string[] }) => void;

  server_error: (data: ServerErrorPayload) => void;

  /** Real-time notification (sent to user:${userId} room) */
  notification_new: (data: NotificationPayload) => void;
}

// ─── Socket Data ──────────────────────────────────────────────────────────────
export interface SocketData {
  user: AuthenticatedUser;
  connectedAt: Date;
  activeRooms: Set<string>;
}

// ─── Payload Types ────────────────────────────────────────────────────────────
export interface JoinRoomPayload {
  roomId?: string;
  roomType?: RoomType;
  targetId?: string;
}

export interface LeaveRoomPayload {
  roomId: string;
}

export interface SendMessagePayload {
  roomId: string;
  content: string;
  tempId: string;
  fileUrl?: string;
  fileType?: string;
}

export interface TypingPayload {
  roomId: string;
}

// ─── Success Response Types ───────────────────────────────────────────────────
export interface JoinRoomSuccess {
  roomId: string;
  users: OnlineUserInfo[];
  history: BroadcastMessage[];
  totalMessages: number;
}

export interface MessageSentSuccess {
  messageId: string;
  tempId: string;
  createdAt: string;
}

export interface RoomStatusSuccess {
  roomId: string;
  membersCount: number;
  isActive: boolean;
}

// ─── Broadcast Types ──────────────────────────────────────────────────────────
export interface BroadcastMessage {
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
  createdAt: string;
}

export interface OnlineUserInfo {
  userId: string;
  name: string;
  image: string | null;
  role: Role;
  connectedAt: string;
}

export interface MessageBroadcastPayload {
  id: string;
  tempId: string;
  content: string;
  fileUrl: string | null;
  fileType: string | null;
  senderId: string;
  senderName: string;
  senderImage: string | null;
  senderRole: Role;
  roomId: string;
  courseId: string | null;
  projectId: string | null;
  isSupport: boolean;
  isSystem: boolean;
  createdAt: string;
}

export interface TypingIndicatorPayload {
  roomId: string;
  userId: string;
  name: string;
  isTyping: boolean;
}

export interface UserRoomEventPayload {
  roomId: string;
  userId?: string;
  name?: string;
  user?: OnlineUserInfo;
}

export interface PresencePayload {
  userId: string;
  name: string;
  image: string | null;
  role?: Role;
  connectedAt?: string;
  disconnectedAt?: string;
}

export interface ServerErrorPayload {
  code: string;
  message: string;
  timestamp?: string;
}

// ─── Notification Types ───────────────────────────────────────────────────────
export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

// ─── Generic Response Wrapper ─────────────────────────────────────────────────
export type SocketResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

// ─── Typed Socket Aliases ─────────────────────────────────────────────────────
export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;