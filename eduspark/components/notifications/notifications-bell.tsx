"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Bell } from "lucide-react";
import { useNotifications } from "@/components/providers/notifications-provider";

export function NotificationsBell() {
  const t = useTranslations("notifications.bell");
  const { unreadCount, isConnected } = useNotifications();

  return (
    <Link
      href="/dashboard/notifications"
      className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-accent transition-colors"
      aria-label={t("aria")}
      title={isConnected ? t("connected") : t("connecting")}
    >
      <Bell className="w-4 h-4 text-muted-foreground" />

      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center tabular-nums">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}

      {isConnected && (
        <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-border" />
      )}
    </Link>
  );
}