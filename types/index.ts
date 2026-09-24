import type { Socket, Server } from "socket.io";

// ─── Auth & User ──────────────────────────────────────────────────────────────

export type UserRole = "STUDENT" | "CREATOR" | "ADMIN";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  image: string | null;
}

export interface OnlineUserInfo {
  userId: string;
  name: string;
  image: string | null;
  role: UserRole;
  connectedAt: string; // ISO string
}

// ─── Room ─────────────────────────────────────────────────────────────────────

export type RoomPrefix = "chat" | "course" | "support";

// Structured room identifier
export interface ParsedRoomId {
  prefix: RoomPrefix;
  entityId: string;
  raw: string; // original "prefix:entityId"
}

export interface JoinRoomPayload {
  roomId: string; // format: "chat:uuid" | "course:uuid" | "support:uuid"
}

export interface LeaveRoomPayload {
  roomId: string;
}

export interface RoomJoinedPayload {
  roomId: string;
  users: OnlineUserInfo[];
  history: BroadcastMessage[];
  totalMessages: number;
}

export interface RoomUsersPayload {
  roomId: string;
  users: OnlineUserInfo[];
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export interface SendMessagePayload {
  roomId: string;
  content: string;
  tempId: string; // client-assigned ID for optimistic updates
  replyToId?: string; // optional: reply thread
}

export interface BroadcastMessage {
  id: string;         // server-assigned (DB id or generated UUID for transient)
  tempId: string;     // echoed from client payload for optimistic UI reconciliation
  chatRoomId: string;
  content: string;
  isSystem: boolean;
  sender: {
    id: string;
    name: string;
    image: string | null;
  };
  replyToId: string | null;
  createdAt: string; // ISO string
}

export interface MessageAckPayload {
  messageId: string;
  tempId: string;
  createdAt: string;
}

// ─── Presence ─────────────────────────────────────────────────────────────────

export interface PresenceOnlinePayload {
  userId: string;
  name: string;
  image: string | null;
  role: UserRole;
  connectedAt: string;
}

export interface PresenceOfflinePayload {
  userId: string;
  name: string;
  disconnectedAt: string;
}

// ─── Typing ───────────────────────────────────────────────────────────────────

export interface TypingPayload {
  roomId: string;
}

export interface TypingIndicatorPayload {
  roomId: string;
  userId: string;
  name: string;
  isTyping: boolean;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "ROOM_NOT_FOUND"
  | "ROOM_ACCESS_DENIED"
  | "INVALID_PAYLOAD"
  | "RATE_LIMITED"
  | "MESSAGE_TOO_LONG"
  | "MESSAGE_EMPTY"
  | "SERVER_ERROR";

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
}

// ─── Acknowledgement wrapper ──────────────────────────────────────────────────

export type AckResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorPayload };

// ─── Socket.io typed interfaces ───────────────────────────────────────────────

export interface ClientToServerEvents {
  join_room: (
    payload: JoinRoomPayload,
    ack: (response: AckResponse<RoomJoinedPayload>) => void
  ) => void;

  leave_room: (payload: LeaveRoomPayload) => void;

  send_message: (
    payload: SendMessagePayload,
    ack: (response: AckResponse<MessageAckPayload>) => void
  ) => void;

  typing_start: (payload: TypingPayload) => void;
  typing_stop: (payload: TypingPayload) => void;

  get_room_users: (
    payload: { roomId: string },
    ack: (response: AckResponse<RoomUsersPayload>) => void
  ) => void;
}

export interface ServerToClientEvents {
  message_new: (message: BroadcastMessage) => void;
  message_saved: (data: MessageAckPayload) => void;
  message_error: (data: { tempId: string; error: ErrorPayload }) => void;

  user_joined: (data: { roomId: string; user: OnlineUserInfo }) => void;
  user_left: (data: { roomId: string; userId: string; name: string }) => void;

  presence_online: (data: PresenceOnlinePayload) => void;
  presence_offline: (data: PresenceOfflinePayload) => void;

  typing_indicator: (data: TypingIndicatorPayload) => void;
  room_users: (data: RoomUsersPayload) => void;

  server_error: (data: ErrorPayload) => void;
  reconnect_ack: (data: { recoveredRooms: string[] }) => void;
}

export interface SocketData {
  user: AuthenticatedUser;
  joinedRooms: Set<string>;
  connectedAt: Date;
  lastActivity: Date;
}

// ─── Convenience aliases ──────────────────────────────────────────────────────

export type SocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export type AuthenticatedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;