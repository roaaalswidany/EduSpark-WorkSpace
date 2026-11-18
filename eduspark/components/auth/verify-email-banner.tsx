"use client";

import { useState, useTransition } from "react";
import { resendVerificationEmailAction } from "@/actions/auth/verify-email";

export function VerifyEmailBanner() {
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-400">
      <span className="flex-1 min-w-50">
        Please confirm your email address to unlock ordering, certification and publishing.
      </span>
      {msg ? (
        <span className="text-amber-700 dark:text-amber-300 font-medium">{msg}</span>
      ) : (
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const r = await resendVerificationEmailAction();
              setMsg(r.success ? "Email sent — check your inbox." : r.error);
            })
          }
          className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 font-medium disabled:opacity-50 transition-colors shadow-sm"
        >
          {isPending ? "Sending…" : "Resend email"}
        </button>
      )}
    </div>
  );
}