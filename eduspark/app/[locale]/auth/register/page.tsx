"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Loader2,
  Sparkles,
  AlertCircle,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import { registerAction, type RegisterInput } from "@/actions/auth/register";

type FieldErrors = Partial<Record<keyof RegisterInput, string[]>>;

export default function RegisterPage() {
  const t = useTranslations("auth.register");
  const locale = useLocale();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isPending, setIsPending] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Password rules — defined inside component so they can use t()
  const PASSWORD_RULES = [
    { regex: /.{8,}/, label: t("rulesMinLength") },
    { regex: /[A-Z]/, label: t("rulesUppercase") },
    { regex: /[a-z]/, label: t("rulesLowercase") },
    { regex: /[0-9]/, label: t("rulesNumber") },
    { regex: /[^A-Za-z0-9]/, label: t("rulesSpecial") },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});
    setIsPending(true);

    const result = await registerAction({
      name,
      email,
      password,
      confirmPassword,
    });

    setIsPending(false);

    if (!result.success) {
      setGeneralError(result.error);
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      return;
    }

    router.push(`/${locale}/auth/login?registered=1`);
  }

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
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
            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                {t("nameLabel")}
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                placeholder={t("namePlaceholder")}
                className="w-full h-11 px-3 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 transition-all"
              />
              {fieldErrors.name?.[0] && (
                <p className="text-xs text-destructive mt-1.5">
                  {fieldErrors.name[0]}
                </p>
              )}
            </div>

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
              {fieldErrors.email?.[0] && (
                <p className="text-xs text-destructive mt-1.5">
                  {fieldErrors.email[0]}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                {t("passwordLabel")}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
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
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Password rules */}
              {password.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {PASSWORD_RULES.map((rule, i) => {
                    const passed = rule.regex.test(password);
                    return (
                      <li
                        key={i}
                        className={`flex items-center gap-1.5 text-xs ${
                          passed
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground/70"
                        }`}
                      >
                        <Check
                          className={`w-3 h-3 ${
                            passed ? "opacity-100" : "opacity-30"
                          }`}
                        />
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              )}

              {fieldErrors.password?.[0] && (
                <p className="text-xs text-destructive mt-1.5">
                  {fieldErrors.password[0]}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                {t("confirmPasswordLabel")}
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isPending}
                  placeholder={t("confirmPasswordPlaceholder")}
                  className="w-full h-11 pl-3 pr-11 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  disabled={isPending}
                  aria-label={
                    showConfirmPassword ? t("hidePassword") : t("showPassword")
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-50"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-destructive mt-1.5">
                  {t("errorPasswordsDoNotMatch")}
                </p>
              )}
              {fieldErrors.confirmPassword?.[0] && (
                <p className="text-xs text-destructive mt-1.5">
                  {fieldErrors.confirmPassword[0]}
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {t("termsNote")}
            </p>

            {/* General error */}
            {generalError && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{generalError}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={
                isPending ||
                !name ||
                !email ||
                !password ||
                !confirmPassword ||
                !passwordsMatch
              }
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
            {t("hasAccount")}{" "}
            <Link
              href="/auth/login"
              className="text-primary hover:text-primary/80 font-medium"
            >
              {t("signInLink")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}