"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, GraduationCap, AlertCircle, Clock, Sparkles } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  NO_ACCOUNT: "No account found with this email.",
  INVALID_PASSWORD: "Incorrect password. Please try again.",
  ACCOUNT_DISABLED: "Your account has been disabled. Contact support.",
  OAUTH_ACCOUNT: "This account uses social login. Please use that instead.",
  INVALID_INPUT: "Please enter a valid email and password.",
  VALIDATION_ERROR: "Please enter a valid email and password.",
  SERVER_ERROR: "Something went wrong. Please try again later.",
  CredentialsSignin: "Invalid email or password.",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsRateLimited(false);
    setIsPending(true);

    try {
      const { loginAction } = await import("@/actions/auth/login");
      const check = await loginAction({ email, password });

      if (!check.success) {
        if (check.code === "RATE_LIMITED") {
          setIsRateLimited(true);
          setRetryAfter(check.retryAfterSec ?? 0);
          setError(check.error);
          setIsPending(false);
          return;
        }
        setError(check.error);
        setIsPending(false);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        const code = result.error.split(":").pop() ?? result.error;
        setError(ERROR_MESSAGES[code] ?? "Sign-in failed. Please try again.");
        setIsPending(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      console.error("[LOGIN_FORM]", err);
      setError("Something went wrong. Please try again.");
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
 <div className="flex flex-col items-center mb-8">
  {/* Logo — clickable, matches landing page branding */}
  <Link href="/" className="flex items-center gap-2.5 mb-7 group">
    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform">
      <Sparkles className="w-5 h-5 text-white" />
    </div>
    <span className="text-xl font-black text-white tracking-tight">
      EduSpark
    </span>
  </Link>

  <h1 className="text-2xl font-bold text-white">Welcome back</h1>
  <p className="text-sm text-slate-500 mt-1">
    Sign in to continue to EduSpark
  </p>
</div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
                placeholder="you@example.com"
                className="w-full h-11 px-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                placeholder="••••••••"
                className="w-full h-11 px-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all"
              />
            </div>

            {error && isRateLimited && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-300">{error}</p>
                  {retryAfter > 0 && (
                    <p className="text-xs text-amber-400/70 mt-1">
                      Please wait {Math.ceil(retryAfter / 60)} minute
                      {Math.ceil(retryAfter / 60) === 1 ? "" : "s"} before trying again.
                    </p>
                  )}
                </div>
              </div>
            )}

            {error && !isRateLimited && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending || !email || !password}
              className="w-full h-11 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/auth/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}