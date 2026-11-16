"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useNotifications } from "@/components/providers/notifications-provider";

export function NotificationsBell() {
  const { unreadCount, isConnected } = useNotifications();

  return (
    <Link
      href="/dashboard/notifications"
      className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-accent transition-colors"
      aria-label="Notifications"
      title={isConnected ? "Real-time enabled" : "Connecting..."}
    >
      <Bell className="w-4 h-4 text-muted-foreground" />

      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}

      {isConnected && (
        <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-slate-950" />
      )}
    </Link>
  );
}