// ============================================================================
// Emit real-time notifications to the chat server
// The chat server then broadcasts to the user's personal room via Socket.io
// ============================================================================

const CHAT_SERVER_URL =
  process.env.NEXT_PUBLIC_CHAT_SERVER_URL ?? "http://localhost:3001";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

export interface NotificationEmitPayload {
  id: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface EmitNotificationInput {
  userId: string;
  notification: NotificationEmitPayload;
}

/**
 * Fire-and-forget emit. Never throws — failures are logged and swallowed
 * so DB writes are never blocked by socket delivery issues.
 */
export async function emitNotification(
  input: EmitNotificationInput
): Promise<void> {
  if (!INTERNAL_SECRET) {
    console.warn(
      "[NOTIFY] INTERNAL_API_SECRET missing — skipping real-time emit"
    );
    return;
  }

  try {
    const res = await fetch(`${CHAT_SERVER_URL}/internal/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`[NOTIFY] emit failed with status ${res.status}`);
    }
  } catch (err) {
    console.warn(
      "[NOTIFY] emit error:",
      err instanceof Error ? err.message : String(err)
    );
  }
}