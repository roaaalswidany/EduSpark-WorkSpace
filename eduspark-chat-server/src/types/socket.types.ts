// ============================================================================
// تعريفات TypeScript الكاملة لنظام Socket.io
// كل interface هنا يمثّل عقداً صارماً بين الـ Client والـ Server
// ============================================================================

import type { Socket, Server } from "socket.io";
import type { Role } from "@prisma/client";

// ─── بيانات المستخدم المُرفَقة بكل socket بعد المصادقة ─────────────────────
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  image: string | null;
}

// ─── أنواع الغرف المدعومة ────────────────────────────────────────────────────
export type RoomType =
  | "course-study-group"   // غرفة دراسة مقرّر — محدودة بالمسجَّلين
  | "project-workspace"    // غرفة مشروع — محدودة بالعميل والمستقل
  | "support-channel";     // قناة دعم — شخصية للمستخدم

// ─── معرّف الغرفة المُنظَّم ──────────────────────────────────────────────────
export interface ParsedRoomId {
  type: RoomType;
  targetId: string;          // courseId أو projectId أو userId
  fullRoomId: string;        // "course-study-group-clx123" المعرّف الكامل
}

// ─── الأحداث الواردة من العميل إلى الخادم ────────────────────────────────────
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

// ─── الأحداث الصادرة من الخادم إلى العميل ───────────────────────────────────
export interface ServerToClientEvents {
  // استقبال رسالة جديدة
  new_message: (data: MessageBroadcastPayload) => void;

  // مؤشّر كتابة
  user_typing: (data: TypingBroadcastPayload) => void;
  user_stopped_typing: (data: TypingBroadcastPayload) => void;

  // تحديثات حالة الغرفة
  user_joined_room: (data: UserRoomEventPayload) => void;
  user_left_room: (data: UserRoomEventPayload) => void;

  // حالة الاتصال
  connection_acknowledged: (data: ConnectionAckPayload) => void;

  // أخطاء الخادم
  server_error: (data: ServerErrorPayload) => void;
}

// ─── بيانات Socket المُرفَقة ─────────────────────────────────────────────────
export interface SocketData {
  user: AuthenticatedUser;
  connectedAt: Date;
  activeRooms: Set<string>;
}

// ─── Payload Types ───────────────────────────────────────────────────────────

export interface JoinRoomPayload {
  roomType: RoomType;
  targetId: string;         // courseId, projectId, أو userId
}

export interface LeaveRoomPayload {
  roomId: string;           // المعرّف الكامل للغرفة
}

export interface SendMessagePayload {
  roomId: string;           // المعرّف الكامل للغرفة
  content: string;          // محتوى الرسالة
  tempId: string;           // معرّف مؤقت من العميل للـ optimistic UI
  fileUrl?: string;         // رابط ملف مرفق (اختياري)
  fileType?: string;        // نوع الملف (اختياري)
}

export interface TypingPayload {
  roomId: string;
}

// ─── Success Response Types ───────────────────────────────────────────────────

export interface JoinRoomSuccess {
  roomId: string;
  membersCount: number;
  recentMessages: MessageBroadcastPayload[];
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

// ─── Broadcast Types ─────────────────────────────────────────────────────────

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

// ─── Generic Response Wrapper ─────────────────────────────────────────────────
export type SocketResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

// ─── Typed Socket Aliases ────────────────────────────────────────────────────
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