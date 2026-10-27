"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/actions/auth/password-reset";
import { AuthCard, buttonClass, inputClass } from "@/components/auth/auth-card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await requestPasswordResetAction(email);
      if (res.success) setSent(true);
      else setError(res.error);
    });
  }

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter your account email and we will send you a reset link."
    >
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm text-emerald-400">
            If an account exists for <b>{email}</b>, a reset link is on its way. It expires in
            1 hour.
          </p>
          <Link href="/auth/login" className="block text-center text-sm text-indigo-400 hover:text-indigo-300">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
              Email
            </label>
            <input
              id="email" type="email" required autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} disabled={isPending}
              placeholder="you@example.com" className={inputClass}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={isPending || !email} className={buttonClass}>
            {isPending ? "Sending…" : "Send reset link"}
          </button>
          <Link href="/auth/login" className="block text-center text-sm text-slate-400 hover:text-slate-200">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthCard>
  );
}
