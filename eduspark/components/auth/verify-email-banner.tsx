"use client";

import { useState, useTransition } from "react";
import { resendVerificationEmailAction } from "@/actions/auth/verify-email";

export function VerifyEmailBanner() {
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      <span className="flex-1 min-w-[200px]">
        Please confirm your email address to unlock ordering, certification and publishing.
      </span>
      {msg ? (
        <span className="text-amber-100">{msg}</span>
      ) : (
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const r = await resendVerificationEmailAction();
              setMsg(r.success ? "Email sent — check your inbox." : r.error);
            })
          }
          className="rounded-lg bg-amber-500/20 px-3 py-1.5 font-medium hover:bg-amber-500/30 disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Resend email"}
        </button>
      )}
    </div>
  );
}
