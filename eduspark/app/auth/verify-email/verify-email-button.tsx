"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { verifyEmailAction } from "@/actions/auth/verify-email";
import { buttonClass } from "@/components/auth/auth-card";

export function VerifyEmailButton({ email, token }: { email: string; token: string }) {
  const [state, setState] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  if (state === "ok") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-emerald-400">Your email address is confirmed. Thank you!</p>
        <Link href="/dashboard" className={buttonClass}>Go to dashboard</Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Confirm that <b className="text-foreground">{email}</b> is your email address.</p>
      {state === "error" && <p className="text-sm text-destructive">{message}</p>}
      <button
        disabled={isPending}
        className={buttonClass}
        onClick={() =>
          startTransition(async () => {
            const res = await verifyEmailAction({ email, token });
            if (res.success) setState("ok");
            else { setState("error"); setMessage(res.error); }
          })
        }
      >
        {isPending ? "Confirmingâ€¦" : "Confirm email"}
      </button>
    </div>
  );
}
