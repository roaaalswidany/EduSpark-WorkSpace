"use client";

import { useState, useTransition } from "react";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { broadcastNotificationAction } from "@/actions/admin/manage-platform";

export function BroadcastForm() {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return;

    startTransition(async () => {
      const result = await broadcastNotificationAction({ title, body });
      
      if (result.success) {
        toast.success(`Notification sent to ${result.count} users! 🎉`);
        setTitle("");
        setBody("");
      } else {
        toast.error(result.error || "Failed to send notification");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        placeholder="Notification Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={isPending}
        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
      />
      <textarea
        placeholder="Message body..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={isPending}
        rows={3}
        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none resize-none"
      />
      <button
        type="submit"
        disabled={isPending || !title || !body}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-50 transition-colors"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {isPending ? "Sending..." : "Send to All Users"}
      </button>
    </form>
  );
}