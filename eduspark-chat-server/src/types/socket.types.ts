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
}

// ─── Server → Client Events ───────────────────────────────────────────────────
export interface ServerToClientEvents {
  new_message: (data: MessageBroadcastPayload) => void;
  user_typing: (data: TypingBroadcastPayload) => void;
  user_stopped_typing: (data: TypingBroadcastPayload) => void;
  user_joined_room: (data: UserRoomEventPayload) => void;
  user_left_room: (data: UserRoomEventPayload) => void;
  connection_acknowledged: (data: ConnectionAckPayload) => void;
  server_error: (data: ServerErrorPayload) => void;
}

// ─── Socket Data ──────────────────────────────────────────────────────────────
export interface SocketData {
  user: AuthenticatedUser;
  connectedAt: Date;
  activeRooms: Set<string>;
}

// ─── Payload Types ────────────────────────────────────────────────────────────

// Accept BOTH formats: { roomId } from ChatBox, or { roomType, targetId } from legacy
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

// Matches ChatBox's `RoomUsersPayload` / `RoomJoinedPayload` expectations
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

export interface TypingBroadcastPayload {
  userId: string;
  userName: string;
  roomId: string;
}

export interface UserRoomEventPayload {
  userId: string;
  userName: string;
  userImage: string | null;
  roomId: string;
  timestamp: string;
}

export interface ConnectionAckPayload {
  userId: string;
  connectedAt: string;
  serverVersion: string;
}

export interface ServerErrorPayload {
  code: string;
  message: string;
  timestamp: string;
}

// ─── Generic Response Wrapper (uses `ok` to match ChatBox) ────────────────────
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