"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Bell,
  CheckCircle2,
  X,
  Trash2,
  ExternalLink,
  Loader2,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  deleteNotificationAction,
} from "@/actions/notifications/manage-notifications";

export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsClientProps {
  notifications: NotificationRow[];
  unreadCount: number;
}

export function NotificationsClient({
  notifications,
  unreadCount,
}: NotificationsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localReadIds, setLocalReadIds] = useState<Set<string>>(new Set());

  const selected = notifications.find((n) => n.id === selectedId) ?? null;

  const isActuallyRead = (n: NotificationRow) =>
    n.isRead || localReadIds.has(n.id);

  const handleOpen = (n: NotificationRow) => {
    setSelectedId(n.id);
    if (!isActuallyRead(n)) {
      setLocalReadIds((prev) => new Set(prev).add(n.id));
      startTransition(async () => {
        const result = await markNotificationReadAction({ id: n.id });
        if (result.success) router.refresh();
      });
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteNotificationAction({ id });
      if (result.success) {
        toast.success("Notification deleted");
        if (selectedId === id) setSelectedId(null);
        router.refresh();
      } else {
        toast.error("Failed to delete notification");
      }
      setDeletingId(null);
    });
  };

  const handleMarkAll = () => {
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (result.success) {
        toast.success("All notifications marked as read");
        setLocalReadIds(new Set(notifications.map((n) => n.id)));
        router.refresh();
      } else {
        toast.error("Failed to mark all as read");
      }
    });
  };

  return (
    <>
      {/* Mark All Button */}
      {unreadCount > 0 && (
        <div className="flex justify-end mb-3">
          <button
            onClick={handleMarkAll}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all as read
          </button>
        </div>
      )}

      {/* Notification List */}
      <div className="space-y-2">
        {notifications.map((n) => {
          const read = isActuallyRead(n);
          const isDeleting = deletingId === n.id;

          return (
            <div
              key={n.id}
              onClick={() => handleOpen(n)}
              className={cn(
                "group rounded-2xl border p-4 transition-all cursor-pointer relative",
                read
                  ? "bg-slate-900 border-slate-800 hover:border-slate-700"
                  : "bg-indigo-500/5 border-indigo-500/20 hover:bg-indigo-500/10"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 justify-between">
                    <p className="text-sm font-semibold text-white truncate">
                      {n.title}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {!read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-400" />
                      )}
                      <button
                        onClick={(e) => handleDelete(n.id, e)}
                        disabled={isDeleting || isPending}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10"
                        aria-label="Delete notification"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 text-red-400 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5 text-slate-500 hover:text-red-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {n.body}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-2">
                    {new Date(n.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3 px-6 py-5 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-white leading-snug">
                  {selected.title}
                </h2>
                <p className="text-[11px] text-slate-500 mt-1">
                  {new Date(selected.createdAt).toLocaleString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 flex items-center justify-center transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {selected.body}
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-950/40">
              <button
                onClick={() => setSelectedId(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
              {selected.link && (
                <Link
                  href={selected.link}
                  onClick={() => setSelectedId(null)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Go to page
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}