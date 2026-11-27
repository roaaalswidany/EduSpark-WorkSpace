"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Loader2,
  Sparkles,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
} from "lucide-react";

export function LoginForm() {
  const t = useTranslations("auth.signIn");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? `/${locale}/dashboard`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [isPending, setIsPending] = useState(false);

  function getErrorMessage(code: string): string {
    const messages: Record<string, string> = {
      NO_ACCOUNT: t("errorInvalid"),
      INVALID_PASSWORD: t("errorInvalid"),
      ACCOUNT_DISABLED: t("errorAccountDisabled"),
      OAUTH_ACCOUNT: t("errorOauth"),
      INVALID_INPUT: t("errorInvalid"),
      VALIDATION_ERROR: t("errorInvalid"),
      SERVER_ERROR: t("errorGeneric"),
      CredentialsSignin: t("errorInvalid"),
      RATE_LIMITED: t("errorRateLimited"),
    };
    return messages[code] ?? t("errorInvalid");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsRateLimited(false);
    setIsPending(true);

    try {
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
        }
        setError(getErrorMessage(code));
        setIsPending(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      console.error("[LOGIN_FORM]", err);
      setError(t("errorGeneric"));
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo + Heading */}
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-2.5 mb-7 group">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black text-foreground tracking-tight">
              EduSpark
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitle")}
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
                {t("emailLabel")}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
                placeholder={t("emailPlaceholder")}
                className="w-full h-11 px-3 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground"
                >
                  {t("passwordLabel")}
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-primary hover:text-primary/80"
                >
                  {t("forgotPassword")}
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
                  placeholder={t("passwordPlaceholder")}
                  className="w-full h-11 pl-3 pr-11 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 transition-all"
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
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    {error}
                  </p>
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
              className="w-full h-11 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("submittingButton")}
                </>
              ) : (
                t("submitButton")
              )}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t("noAccount")}{" "}
            <Link
              href="/auth/register"
              className="text-primary hover:text-primary/80 font-medium"
            >
              {t("createAccount")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}