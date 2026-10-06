/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSocket } from "@/hooks/useSocket";

export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsContextValue {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  isConnected: boolean;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null
);

interface NotificationsProviderProps {
  userId: string;
  initialUnreadCount: number;
  children: React.ReactNode;
}

export function NotificationsProvider({
  userId,
  initialUnreadCount,
  children,
}: NotificationsProviderProps) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const { socket, isConnected } = useSocket();
  const router = useRouter();

  // Sync when server count changes
  useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  // Listen for real-time notifications
  useEffect(() => {
    if (!socket) return;

    const handler = (payload: NotificationPayload) => {
      setUnreadCount((c) => c + 1);

      // Show toast with action
      toast(payload.title, {
        description: payload.body,
        action: payload.link
          ? {
              label: "View",
              onClick: () => router.push(payload.link!),
            }
          : undefined,
        duration: 6000,
      });

      // Refresh server components so bell + page stay in sync
      router.refresh();
    };

    socket.on("notification_new", handler);
    return () => {
      socket.off("notification_new", handler);
    };
  }, [socket, router]);

  const setUnreadCountStable = useCallback(
    (n: number) => setUnreadCount(n),
    []
  );

  return (
    <NotificationsContext.Provider
      value={{
        unreadCount,
        setUnreadCount: setUnreadCountStable,
        isConnected,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within NotificationsProvider"
    );
  }
  return ctx;
}