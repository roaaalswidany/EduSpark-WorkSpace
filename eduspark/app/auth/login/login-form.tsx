"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Sparkles,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
} from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  NO_ACCOUNT: "No account found with this email.",
  INVALID_PASSWORD: "Incorrect password. Please try again.",
  ACCOUNT_DISABLED: "Your account has been disabled. Contact support.",
  OAUTH_ACCOUNT: "This account uses social login. Please use that instead.",
  INVALID_INPUT: "Please enter a valid email and password.",
  VALIDATION_ERROR: "Please enter a valid email and password.",
  SERVER_ERROR: "Something went wrong. Please try again later.",
  CredentialsSignin: "Invalid email or password.",
  RATE_LIMITED: "Too many login attempts. Please try again in 15 minutes.",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsRateLimited(false);
    setIsPending(true);

    try {
      // ظ†ط³طھط®ط¯ظ… signIn ظ…ط¨ط§ط´ط±ط© ظ„ظٹطھط­ظ‚ظ‚ ظ…ظ† ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ظˆظٹطµط¯ط± ط§ظ„ظƒظˆظƒظٹط² ظپظٹ ط®ط·ظˆط© ظˆط§ط­ط¯ط©
      // ظ‡ط°ط§ ظٹظ…ظ†ط¹ ط§ظ„ط­ط¸ط± ط§ظ„ظ…ط²ط¯ظˆط¬ ظˆظٹط­ظ„ ط§ظ„ظ…ط´ظƒظ„ط©
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        const code = result.error.split(":").pop() ?? result.error;
        
        if (code === "RATE_LIMITED") {
          setIsRateLimited(true);
          setError(ERROR_MESSAGES[code]);
        } else {
          setError(ERROR_MESSAGES[code] ?? "Invalid email or password.");
        }
        setIsPending(false);
        return;
      }

      // ظ†ط¬ط§ط­
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      console.error("[LOGIN_FORM]", err);
      setError("Something went wrong. Please try again.");
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-2.5 mb-7 group">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black text-white tracking-tight">
              EduSpark
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to continue to EduSpark
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
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
                className="w-full h-11 px-3 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground"
                >
                  Password
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-primary hover:text-primary"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isPending}
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  className="w-full h-11 pl-3 pr-11 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={isPending}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Rate Limited Error */}
            {error && isRateLimited && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-300">{error}</p>
                </div>
              </div>
            )}

            {/* Generic Error */}
            {error && !isRateLimited && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending || !email || !password}
              className="w-full h-11 rounded-lg bg-primary hover:bg-primary text-primary-foreground font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing inâ€¦
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/register"
              className="text-primary hover:text-primary font-medium"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}