"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { broadcastNotificationAction } from "@/actions/admin/manage-platform";

export function BroadcastForm() {
  const t = useTranslations("admin.broadcast");
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return;

    startTransition(async () => {
      const result = await broadcastNotificationAction({ title, body });

      if (result.success) {
        toast.success(t("successToast", { count: result.count ?? 0 }));
        setTitle("");
        setBody("");
      } else {
        toast.error(result.error || t("failedToast"));
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        placeholder={t("titlePlaceholder")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={isPending}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
      />
      <textarea
        placeholder={t("bodyPlaceholder")}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={isPending}
        rows={3}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none resize-none"
      />
      <button
        type="submit"
        disabled={isPending || !title || !body}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4 rtl:rotate-180" />
        )}
        {isPending ? t("sending") : t("sendToAll")}
      </button>
    </form>
  );
}