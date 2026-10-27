"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { resetPasswordAction } from "@/actions/auth/password-reset";
import { buttonClass, inputClass } from "@/components/auth/auth-card";

export function ResetPasswordForm({ email, token }: { email: string; token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await resetPasswordAction({ email, token, password, confirmPassword });
      if (res.success) setDone(true);
      else setError(res.fieldErrors?.password?.[0] ?? res.fieldErrors?.confirmPassword?.[0] ?? res.error);
    });
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-emerald-400">Your password was changed. You can sign in now.</p>
        <Link href="/auth/login" className={buttonClass}>Sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-xs text-slate-500">Resetting the password for {email}</p>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">New password</label>
        <input id="password" type="password" required autoComplete="new-password" value={password}
          onChange={(e) => setPassword(e.target.value)} disabled={isPending} className={inputClass} />
        <p className="text-xs text-slate-500 mt-1.5">
          8–72 characters with an uppercase letter, a lowercase letter, a number and a symbol.
        </p>
      </div>
      <div>
        <label htmlFor="confirm" className="block text-sm font-medium text-slate-300 mb-1.5">Confirm password</label>
        <input id="confirm" type="password" required autoComplete="new-password" value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)} disabled={isPending} className={inputClass} />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={isPending || !password} className={buttonClass}>
        {isPending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
