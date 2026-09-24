"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, type Socket } from "socket.io-client";
import type { SocketStatus } from "@/types/chat";

// ─── Configuration ────────────────────────────────────────────────────────────

const CHAT_SERVER_URL =
  process.env.NEXT_PUBLIC_CHAT_SERVER_URL ?? "http://localhost:3001";

const SOCKET_OPTIONS = {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 8,
  reconnectionDelay: 1_000,
  reconnectionDelayMax: 30_000,
  randomizationFactor: 0.5,
  timeout: 20_000,
  autoConnect: false,
};

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseSocketReturn {
  socket: Socket | null;
  status: SocketStatus;
  error: string | null;
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempt: number;
  disconnect: () => void;
  forceReconnect: () => Promise<void>;
}

// ─── Token fetch ──────────────────────────────────────────────────────────────

async function fetchSocketToken(): Promise<string> {
  const res = await fetch("/api/auth/socket-token", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error(`TOKEN_FETCH_FAILED:${res.status}`);

  const json = (await res.json()) as { token?: string; error?: string };
  if (!json.token) throw new Error("TOKEN_MISSING");

  return json.token;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSocket(): UseSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<SocketStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  // Track component mount to prevent state updates after unmount
  const mountedRef = useRef(true);
  // Hold the raw socket reference for cleanup across re-renders
  const socketRef = useRef<Socket | null>(null);

  // ── Cleanup helper ─────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    const existing = socketRef.current;
    if (!existing) return;

    existing.removeAllListeners();
    existing.disconnect();
    socketRef.current = null;

    if (mountedRef.current) setSocket(null);
  }, []);

  // ── Core initialization ────────────────────────────────────────────────────

  const initSocket = useCallback(async () => {
    if (!mountedRef.current) return;

    cleanup();

    setError(null);
    setReconnectAttempt(0);
    setStatus("fetching_token");

    // Step 1: Obtain auth token from Next.js session
    let token: string;
    try {
      token = await fetchSocketToken();
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : "Authentication failed.";
      const isAuth = msg.includes("UNAUTHORIZED") || msg.includes("TOKEN");
      setStatus(isAuth ? "auth_failed" : "error");
      setError(
        isAuth
          ? "Your session has expired. Please sign in again."
          : "Failed to authenticate the chat connection."
      );
      return;
    }

    if (!mountedRef.current) return;

    // Step 2: Create socket instance (not yet connected)
    setStatus("connecting");

    const newSocket = io(CHAT_SERVER_URL, {
      ...SOCKET_OPTIONS,
      auth: { token },
      // Enables server-side state recovery after brief disconnections
      // (Socket.io 4.6+ feature — works with the server's connectionStateRecovery)
    });

    // ── Lifecycle events ───────────────────────────────────────────────────

    newSocket.on("connect", () => {
      if (!mountedRef.current) return;
      setStatus("connected");
      setError(null);
      setReconnectAttempt(0);
    });

    newSocket.on("disconnect", (reason) => {
      if (!mountedRef.current) return;

      // "io client disconnect" = intentional (disconnect() was called)
      // "io server disconnect" = server kicked us (auth revoked, etc.)
      const isIntentional =
        reason === "io client disconnect" ||
        reason === "io server disconnect";

      setStatus(isIntentional ? "disconnected" : "reconnecting");

      if (reason === "io server disconnect") {
        setError("You were disconnected by the server. Please refresh.");
      }
    });

    newSocket.on("connect_error", (err) => {
      if (!mountedRef.current) return;
      const isAuth =
        err.message.includes("UNAUTHORIZED") ||
        err.message.includes("auth");
      setStatus(isAuth ? "auth_failed" : "error");
      setError(
        isAuth
          ? "Authentication rejected by chat server."
          : `Connection error: ${err.message}`
      );
    });

    // Socket.io Manager events (reconnection loop)
    newSocket.io.on("reconnect_attempt", (attempt: number) => {
      if (!mountedRef.current) return;
      setStatus("reconnecting");
      setReconnectAttempt(attempt);
    });

    newSocket.io.on("reconnect", () => {
      if (!mountedRef.current) return;
      setStatus("connected");
      setError(null);
      setReconnectAttempt(0);
    });

    newSocket.io.on("reconnect_failed", () => {
      if (!mountedRef.current) return;
      setStatus("error");
      setError(
        "Unable to reconnect after multiple attempts. Please check your internet connection."
      );
    });

    newSocket.io.on("error", (err: Error) => {
      if (!mountedRef.current) return;
      setError(`Transport error: ${err.message}`);
    });

    // Step 3: Store reference and trigger connection
    socketRef.current = newSocket;
    setSocket(newSocket);
    newSocket.connect();
  }, [cleanup]);

  // ── Mount / unmount lifecycle ──────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    void initSocket();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
    // Intentionally run only once on mount; forceReconnect is available for manual control
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Public API ─────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    if (mountedRef.current) setStatus("disconnected");
  }, []);

  return {
    socket,
    status,
    error,
    isConnected: status === "connected",
    isReconnecting: status === "reconnecting",
    reconnectAttempt,
    disconnect,
    forceReconnect: initSocket,
  };
}