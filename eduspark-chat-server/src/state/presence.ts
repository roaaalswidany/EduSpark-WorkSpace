import type { AuthenticatedUser, OnlineUserInfo } from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserEntry {
  info: OnlineUserInfo;
  sockets: Set<string>; // A user can have multiple open tabs/connections
}

interface ConnectResult {
  isNewlyOnline: boolean; // true only for the first socket (user was offline)
}

interface DisconnectResult {
  userId: string;
  info: OnlineUserInfo;
  isNowOffline: boolean; // true when the last socket disconnects
}

// ─── Presence Store ───────────────────────────────────────────────────────────
// Thread-safe (single-threaded Node.js) in-memory store.
// Maps userId ↔ socketId ↔ OnlineUserInfo.
// Handles multiple simultaneous connections per user (tabs, devices).

export class PresenceStore {
  // userId → { user info, active socketIds }
  private readonly userMap = new Map<string, UserEntry>();
  // socketId → userId (reverse lookup for O(1) disconnect handling)
  private readonly socketMap = new Map<string, string>();

  // ── Connect ─────────────────────────────────────────────────────────────────

  connect(socketId: string, user: AuthenticatedUser): ConnectResult {
    const existing = this.userMap.get(user.id);
    const isNewlyOnline = existing === undefined || existing.sockets.size === 0;

    const info: OnlineUserInfo = {
      userId: user.id,
      name: user.name,
      image: user.image,
      role: user.role,
      connectedAt: new Date().toISOString(),
    };

    if (existing) {
      existing.sockets.add(socketId);
      existing.info = info; // refresh info (name/image might change)
    } else {
      this.userMap.set(user.id, { info, sockets: new Set([socketId]) });
    }

    this.socketMap.set(socketId, user.id);

    return { isNewlyOnline };
  }

  // ── Disconnect ───────────────────────────────────────────────────────────────

  disconnect(socketId: string): DisconnectResult | null {
    const userId = this.socketMap.get(socketId);
    if (!userId) return null; // unknown socket, likely double-disconnect

    this.socketMap.delete(socketId);

    const entry = this.userMap.get(userId);
    if (!entry) return null;

    entry.sockets.delete(socketId);

    if (entry.sockets.size === 0) {
      this.userMap.delete(userId);
      return { userId, info: entry.info, isNowOffline: true };
    }

    return { userId, info: entry.info, isNowOffline: false };
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  isOnline(userId: string): boolean {
    const entry = this.userMap.get(userId);
    return !!(entry && entry.sockets.size > 0);
  }

  getUserInfo(userId: string): OnlineUserInfo | undefined {
    return this.userMap.get(userId)?.info;
  }

  getUserIdBySocket(socketId: string): string | undefined {
    return this.socketMap.get(socketId);
  }

  getSocketCount(userId: string): number {
    return this.userMap.get(userId)?.sockets.size ?? 0;
  }

  getOnlineUsers(): OnlineUserInfo[] {
    return Array.from(this.userMap.values()).map((e) => e.info);
  }

  getOnlineUserCount(): number {
    return this.userMap.size;
  }

  getTotalConnections(): number {
    return this.socketMap.size;
  }

  // ── Snapshot for health endpoint ─────────────────────────────────────────────

  snapshot(): {
    onlineUsers: number;
    totalConnections: number;
    userIds: string[];
  } {
    return {
      onlineUsers: this.userMap.size,
      totalConnections: this.socketMap.size,
      userIds: Array.from(this.userMap.keys()),
    };
  }
}

// Singleton instance shared across handlers
export const presenceStore = new PresenceStore();